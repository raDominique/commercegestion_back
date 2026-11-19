jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductService } from './products.service';
import { BulkCreateProductMultipartDto } from './dto/bulk-create-product-multipart.dto';
import { productBulkImagesMulter } from './bulk-images.multer';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const parse = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: BulkCreateProductMultipartDto,
  }) as Promise<BulkCreateProductMultipartDto>;

const image = (fieldname: string, mimetype = 'image/jpeg') =>
  ({
    fieldname,
    mimetype,
    originalname: `${fieldname}.jpg`,
  }) as Express.Multer.File;

describe('BulkCreateProductMultipartDto', () => {
  it('parse le champ items (chaîne JSON) en produits validés', async () => {
    const dto = await parse({
      items: JSON.stringify([
        { codeCPC: '01111', productName: 'Blé' },
        { codeCPC: '01121', productName: 'Maïs', productPoids: '50 kg' },
      ]),
    });

    expect(dto.items).toHaveLength(2);
    expect(dto.items[1].productPoids).toBe('50 kg');
  });

  it('refuse un JSON invalide', async () => {
    await expect(parse({ items: '[{codeCPC:' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse un produit sans codeCPC, avec le chemin du champ', async () => {
    const error = await parse({
      items: JSON.stringify([{ productName: 'Blé' }]),
    }).catch((e: BadRequestException) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(
      JSON.stringify((error as BadRequestException).getResponse()),
    ).toContain('items.0.codeCPC');
  });

  it('refuse une liste vide', async () => {
    await expect(parse({ items: '[]' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('productBulkImagesMulter.fileFilter', () => {
  const filter = (file: Express.Multer.File) =>
    new Promise<{ error: Error | null; accepted?: boolean }>((resolve) =>
      productBulkImagesMulter.fileFilter!({} as any, file, (error, accepted) =>
        resolve({ error, accepted }),
      ),
    );

  it('accepte image_<index> de type image', async () => {
    expect(await filter(image('image_3'))).toEqual({
      error: null,
      accepted: true,
    });
  });

  it('refuse un autre nom de champ', async () => {
    const { error } = await filter(image('photo'));
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const { error } = await filter(image('image_0', 'application/pdf'));
    expect(error).toBeInstanceOf(BadRequestException);
  });
});

describe('ProductService.bulkCreateWithImages', () => {
  const cpcId = new Types.ObjectId();
  const build = () => {
    const service = Object.create(ProductService.prototype) as ProductService;
    (service as unknown as { cpcModel: unknown }).cpcModel = {
      findOne: jest.fn(({ code }: { code: string }) =>
        Promise.resolve(
          code === 'INCONNU' ? null : { _id: cpcId, nom: 'Céréales' },
        ),
      ),
    };
    const create = jest.spyOn(service, 'create').mockImplementation((dto) =>
      Promise.resolve({
        status: 'success',
        message: 'ok',
        data: [{ productName: dto.productName } as any],
      }),
    );
    return { service, create };
  };

  it('associe image_<i> au produit items[i] et déduit la catégorie du CPC', async () => {
    const { service, create } = build();
    const img2 = image('image_2');

    const result = await service.bulkCreateWithImages(
      {
        items: [
          { codeCPC: '01111', productName: 'Blé' },
          { codeCPC: 'INCONNU', productName: 'X' },
          { codeCPC: '01111', productName: 'Orge', productCategory: 'Grains' },
        ],
      },
      [img2],
      'user-id',
    );

    expect(result.status).toBe('partial_success');
    expect(result.errors).toEqual([
      { index: 1, reason: 'Code CPC "INCONNU" introuvable' },
    ]);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        productName: 'Blé',
        categoryId: cpcId.toString(),
        productCategory: 'Céréales',
      }),
      'user-id',
      undefined,
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        productName: 'Orge',
        productCategory: 'Grains',
      }),
      'user-id',
      img2,
    );
  });

  it('refuse une image dont l’index ne correspond à aucun produit', async () => {
    const { service, create } = build();

    await expect(
      service.bulkCreateWithImages(
        { items: [{ codeCPC: '01111', productName: 'Blé' }] },
        [image('image_5')],
        'user-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
