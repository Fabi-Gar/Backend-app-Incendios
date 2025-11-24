import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('tecnicas_extincion_catalogo')
export class TecnicaExtincionCatalogo {
  @PrimaryGeneratedColumn('uuid', { name: 'tecnica_id' })
  tecnica_id!: string;

  @Column({ type: 'text', unique: true })
  nombre!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null;
}
