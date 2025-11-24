import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'job_runs' })
@Index('idx_job_runs', ['nombre_job','inicio'])
export class JobRun {
  @PrimaryGeneratedColumn('uuid')
  job_run_uuid!: string;

  @Column('text')
  nombre_job!: string;

  @Column('timestamptz')
  inicio!: Date;

  @Column('timestamptz', { nullable: true })
  fin!: Date | null;

  @Column('text')
  status!: string;

  @Column('integer', { default: 0 })
  insertados!: number;

  @Column('integer', { default: 0 })
  ignorados!: number;

  @Column('integer', { default: 0 })
  asociados!: number;

  @Column('jsonb', { nullable: true })
  errores!: any | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date;
}
