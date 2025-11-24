import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne,
  CreateDateColumn, UpdateDateColumn, JoinColumn, Unique
} from 'typeorm';
import { UserPushPrefs } from './UserPushPrefs';

@Entity({ name: 'user_push_tokens' })
@Unique(['token'])
export class UserPushToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_user_push_token_token')
  @Column({ type: 'varchar', length: 255 })
  token!: string;

  @Index('idx_user_push_token_user_id')
  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @ManyToOne(() => UserPushPrefs, (p) => p.tokens, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'prefs_id' })
  prefs!: UserPushPrefs;

  @Column({ name: 'prefs_id', type: 'uuid' })
  prefsId!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
