import { ApiProperty } from '@nestjs/swagger';

export class LedgerMovementDto {
  @ApiProperty({
    description: 'Date et heure du mouvement',
    example: '2024-01-15T10:30:00Z',
  })
  dateTime: Date;

  @ApiProperty({
    description: 'ID de la transaction',
    example: '69989c5cdff25ef7fe0a460f',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Numéro de transaction unique',
    example: '20240115103000001',
  })
  transactionNumber: string;

  @ApiProperty({
    description: 'Intitulé de la transaction (DÉPÔT, RETOUR, INITIALISATION)',
    example: 'DÉPÔT',
  })
  title: string;

  @ApiProperty({
    description: 'Nom du produit',
    example: 'RIZ MAKALIOKA',
  })
  product: string;

  @ApiProperty({
    description: 'Détenteur ou Ayant-droit',
    example: 'RAKOTO',
  })
  holder: string;

  @ApiProperty({
    description: 'Site concerné',
    example: 'HANGAR ANDRANOMENA',
  })
  site: string;

  @ApiProperty({
    description: 'Quantité transférée (positive ou négative)',
    example: 5000,
  })
  quantity: number;

  @ApiProperty({
    description: 'Stock initial avant le mouvement',
    example: 12500,
  })
  initialStock: number;

  @ApiProperty({
    description: 'Stock final après le mouvement',
    example: 7500,
  })
  finalStock: number;

  @ApiProperty({
    description: 'Type de mouvement (ACTIF ou PASSIF)',
    example: 'ACTIF',
    enum: ['ACTIF', 'PASSIF'],
  })
  movementType: 'ACTIF' | 'PASSIF';
}

export class StockCardDto {
  @ApiProperty({
    description: 'Nom du produit',
    example: 'RIZ MAKALIOKA',
  })
  product: string;

  @ApiProperty({
    description: 'Stock actuel',
    example: 12500,
  })
  currentStock: number;

  @ApiProperty({
    description: 'Mouvements du produit',
    type: [LedgerMovementDto],
  })
  movements: LedgerMovementDto[];
}

export class UserMovementsDto {
  @ApiProperty({
    description: 'Mouvements d\'actifs',
    type: [LedgerMovementDto],
  })
  actifs: LedgerMovementDto[];

  @ApiProperty({
    description: 'Mouvements de passifs',
    type: [LedgerMovementDto],
  })
  passifs: LedgerMovementDto[];
}

export class UserLedgerDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur',
    example: '69989c5cdff25ef7fe0a460f',
  })
  userId: string;

  @ApiProperty({
    description: 'Nom de l\'utilisateur',
    example: 'RAKOTO',
  })
  userName: string;

  @ApiProperty({
    description: 'Tous les mouvements',
    type: UserMovementsDto,
  })
  movements: UserMovementsDto;
}

export class GlobalLedgerDto {
  @ApiProperty({
    description: 'Mouvements du grand livre',
    type: [LedgerMovementDto],
  })
  data: LedgerMovementDto[];

  @ApiProperty({
    description: 'Nombre total de mouvements',
    example: 150,
  })
  total: number;
}
