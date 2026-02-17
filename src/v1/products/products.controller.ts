import { Controller, Get, Post, Body, Param, Patch, Delete, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller()
export class ProductController {
  constructor(private readonly service: ProductService) { }

  @Post()
  @ApiOperation({ summary: 'Créer un produit' })
  create(@Body() dto: CreateProductDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id || 'system_id');
  }

  @Get()
  @ApiOperation({ summary: 'Lister avec pagination' })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('get-by-id/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.id || 'system_id');
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user?.id || 'system_id');
  }
}