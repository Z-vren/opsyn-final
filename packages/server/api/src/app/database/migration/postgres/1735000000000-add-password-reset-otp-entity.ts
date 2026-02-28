import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm'

export class AddPasswordResetOtpEntity1735000000000 implements MigrationInterface {
    name = 'AddPasswordResetOtpEntity1735000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('password_reset_otp')
        if (tableExists) {
            return
        }

        await queryRunner.createTable(
            new Table({
                name: 'password_reset_otp',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '21',
                        isPrimary: true,
                    },
                    {
                        name: 'created',
                        type: 'timestamp with time zone',
                        default: 'now()',
                    },
                    {
                        name: 'updated',
                        type: 'timestamp with time zone',
                        default: 'now()',
                    },
                    {
                        name: 'identityId',
                        type: 'varchar',
                        length: '21',
                        isNullable: false,
                    },
                    {
                        name: 'value',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'state',
                        type: 'varchar',
                        isNullable: false,
                    },
                ],
            }),
            true,
        )

        await queryRunner.createIndex(
            'password_reset_otp',
            new TableIndex({
                name: 'idx_password_reset_otp_identity_id',
                columnNames: ['identityId'],
                isUnique: true,
            }),
        )

        const userIdentityExists = await queryRunner.hasTable('user_identity')
        if (userIdentityExists) {
            await queryRunner.createForeignKey(
                'password_reset_otp',
                new TableForeignKey({
                    name: 'fk_password_reset_otp_identity_id',
                    columnNames: ['identityId'],
                    referencedTableName: 'user_identity',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                }),
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('password_reset_otp', 'fk_password_reset_otp_identity_id')
        await queryRunner.dropIndex('password_reset_otp', 'idx_password_reset_otp_identity_id')
        await queryRunner.dropTable('password_reset_otp')
    }
}

