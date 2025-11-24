import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm'
import { Rol } from './rol.entity'
import { Institucion } from './institucion.entity'

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid', { name: 'usuario_uuid' })
  usuario_uuid!: string

  @Column({ type: 'text', nullable: true })
  nombre!: string | null

  @Column({ type: 'text', nullable: true })
  apellido!: string | null

  @Column({ type: 'text', nullable: true })
  telefono!: string | null

  @Index('uq_usuarios_email_notnull', { unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'text', nullable: true })
  email!: string | null

  @Column({ type: 'text' })
  password_hash!: string

  @ManyToOne(() => Rol, { nullable: false })
  @JoinColumn({ name: 'rol_uuid', referencedColumnName: 'rol_uuid', foreignKeyConstraintName: 'fk_usuarios_rol_uuid' })
  rol!: Rol

  @ManyToOne(() => Institucion, { nullable: true })
  @JoinColumn({ name: 'institucion_uuid', referencedColumnName: 'institucion_uuid', foreignKeyConstraintName: 'fk_usuarios_institucion_uuid' })
  institucion!: Institucion | null

  @Column({ type: 'boolean', name: 'is_admin', default: false })
  is_admin!: boolean

  @Column({ type: 'timestamptz', nullable: true })
  ultimo_login!: Date | null

  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creado_en!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en', default: () => 'now()' })
  actualizado_en!: Date

  @DeleteDateColumn({ type: 'timestamptz', name: 'eliminado_en', nullable: true })
  eliminado_en!: Date | null
}
