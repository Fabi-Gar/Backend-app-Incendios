// src/modules/incendios/entities/incendio-seguidor.entity.ts
import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Incendio } from './incendio.entity'
import { Usuario } from '../../seguridad/entities/usuario.entity'

@Entity('incendio_seguidores')
export class IncendioSeguidor {
  @PrimaryColumn('uuid')
  incendio_uuid!: string

  @PrimaryColumn('uuid')
  usuario_uuid!: string

  @ManyToOne(() => Incendio, (incendio) => incendio.seguidores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incendio_uuid' })
  incendio!: Incendio

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_uuid' })
  usuario!: Usuario

  @CreateDateColumn()
  creado_en!: Date
}
