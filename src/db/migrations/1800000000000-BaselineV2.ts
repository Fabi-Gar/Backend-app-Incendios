import { MigrationInterface, QueryRunner } from "typeorm"

export class BaselineV21800000000000 implements MigrationInterface {
    name = 'BaselineV21800000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ========== EXTENSIONES ==========
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`)
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

        // ========== SEGURIDAD ==========

        // Roles
        await queryRunner.query(`
            CREATE TABLE roles (
                rol_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL UNIQUE,
                descripcion text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz
            )
        `)

        // Instituciones
        await queryRunner.query(`
            CREATE TABLE instituciones (
                institucion_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL UNIQUE,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz
            )
        `)

        // Usuarios (con es_miembro_institucion)
        await queryRunner.query(`
            CREATE TABLE usuarios (
                usuario_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text,
                apellido text,
                telefono text,
                email text,
                password_hash text NOT NULL,
                is_admin boolean NOT NULL DEFAULT false,
                es_miembro_institucion boolean NOT NULL DEFAULT false,
                ultimo_login timestamptz,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                rol_uuid uuid NOT NULL,
                institucion_uuid uuid,
                CONSTRAINT fk_usuarios_rol_uuid
                    FOREIGN KEY (rol_uuid) REFERENCES roles(rol_uuid),
                CONSTRAINT fk_usuarios_institucion_uuid
                    FOREIGN KEY (institucion_uuid) REFERENCES instituciones(institucion_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_usuarios_email_notnull
            ON usuarios (email)
            WHERE email IS NOT NULL
        `)

        // ========== GEOGRAFÍA ==========

        // Departamentos
        await queryRunner.query(`
            CREATE TABLE departamentos (
                departamento_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL UNIQUE,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz
            )
        `)

        // Municipios
        await queryRunner.query(`
            CREATE TABLE municipios (
                municipio_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL,
                departamento_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_municipios_departamento_uuid
                    FOREIGN KEY (departamento_uuid) REFERENCES departamentos(departamento_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_municipios_depto_nombre
            ON municipios (departamento_uuid, nombre)
        `)

        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_municipios_depto_nombre
            ON municipios (departamento_uuid, nombre)
        `)

        // ========== INCENDIOS ==========

        // Estados de incendio
        await queryRunner.query(`
            CREATE TABLE estado_incendio (
                estado_incendio_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                codigo text NOT NULL UNIQUE,
                nombre text NOT NULL,
                orden integer NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz
            )
        `)

        // Medios de reporte
        await queryRunner.query(`
            CREATE TABLE medios (
                medio_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL UNIQUE,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz
            )
        `)

        // Incendios (CON campos de reporte merged, SIN tabla reportes)
        await queryRunner.query(`
            CREATE TABLE incendios (
                incendio_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                -- Control de aprobación
                requiere_aprobacion boolean NOT NULL DEFAULT true,
                aprobado boolean NOT NULL DEFAULT false,
                aprobado_en timestamptz,
                rechazado_en timestamptz,
                motivo_rechazo text,
                aprobado_por uuid,
                rechazado_por uuid,

                -- Datos del incendio
                titulo text,
                descripcion text,
                centroide geometry(Point, 4326),
                estado_incendio_uuid uuid NOT NULL,
                extinguido_at timestamptz,

                -- Campos merged de reportes
                reportado_por_uuid uuid,
                reportado_por_nombre text,
                institucion_reporte_uuid uuid,
                telefono text,
                reportado_en timestamptz,
                medio_uuid uuid,
                departamento_uuid uuid,
                municipio_uuid uuid,
                lugar_poblado text,
                finca text,

                -- Auditoría
                creado_por_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,

                CONSTRAINT fk_incendios_creado_por_uuid
                    FOREIGN KEY (creado_por_uuid) REFERENCES usuarios(usuario_uuid),
                CONSTRAINT fk_incendios_aprobado_por
                    FOREIGN KEY (aprobado_por) REFERENCES usuarios(usuario_uuid),
                CONSTRAINT fk_incendios_rechazado_por
                    FOREIGN KEY (rechazado_por) REFERENCES usuarios(usuario_uuid),
                CONSTRAINT fk_incendios_estado
                    FOREIGN KEY (estado_incendio_uuid) REFERENCES estado_incendio(estado_incendio_uuid),
                CONSTRAINT fk_incendios_reportado_por_uuid
                    FOREIGN KEY (reportado_por_uuid) REFERENCES usuarios(usuario_uuid) ON DELETE SET NULL,
                CONSTRAINT fk_incendios_institucion_reporte_uuid
                    FOREIGN KEY (institucion_reporte_uuid) REFERENCES instituciones(institucion_uuid) ON DELETE SET NULL,
                CONSTRAINT fk_incendios_medio_uuid
                    FOREIGN KEY (medio_uuid) REFERENCES medios(medio_uuid) ON DELETE SET NULL,
                CONSTRAINT fk_incendios_departamento_uuid
                    FOREIGN KEY (departamento_uuid) REFERENCES departamentos(departamento_uuid) ON DELETE SET NULL,
                CONSTRAINT fk_incendios_municipio_uuid
                    FOREIGN KEY (municipio_uuid) REFERENCES municipios(municipio_uuid) ON DELETE SET NULL
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_estado_aprobado
            ON incendios (estado_incendio_uuid, aprobado)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_reportado_en
            ON incendios (reportado_en)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_departamento
            ON incendios (departamento_uuid)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_municipio
            ON incendios (municipio_uuid)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_extinguido_at
            ON incendios (extinguido_at)
            WHERE eliminado_en IS NULL AND extinguido_at IS NOT NULL
        `)

        // Incendio Seguidores
        await queryRunner.query(`
            CREATE TABLE incendio_seguidores (
                incendio_uuid uuid NOT NULL,
                usuario_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT pk_incendio_seguidores PRIMARY KEY (incendio_uuid, usuario_uuid),
                CONSTRAINT fk_incendio_seguidores_incendio
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid) ON DELETE CASCADE,
                CONSTRAINT fk_incendio_seguidores_usuario
                    FOREIGN KEY (usuario_uuid) REFERENCES usuarios(usuario_uuid) ON DELETE CASCADE
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_seguidores_usuario
            ON incendio_seguidores (usuario_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE INDEX idx_seguidores_incendio
            ON incendio_seguidores (incendio_uuid)
            WHERE eliminado_en IS NULL
        `)

        // Info falsa
        await queryRunner.query(`
            CREATE TABLE info_falsa_incendio (
                info_falsa_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid,
                razon text,
                descripcion_detallada text,
                validador_nombre varchar(150),
                validador_contacto varchar(50),
                fecha_verificacion timestamptz,
                ubicacion_verificada geometry(Point, 4326),
                duplicado_de_incendio_uuid uuid,
                score_confianza integer,
                institucion_validadora_uuid uuid,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_info_falsa_incendio
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid) ON DELETE CASCADE,
                CONSTRAINT fk_info_falsa_institucion
                    FOREIGN KEY (institucion_validadora_uuid) REFERENCES instituciones(institucion_uuid)
            )
        `)

        // Registro responsable
        await queryRunner.query(`
            CREATE TABLE incendio_registro_responsable (
                incendio_uuid uuid PRIMARY KEY,
                nombre text NOT NULL,
                cargo text,
                telefono text,
                correo text,
                observaciones text,
                institucion_uuid uuid,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_resp_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_resp_institucion_uuid
                    FOREIGN KEY (institucion_uuid) REFERENCES instituciones(institucion_uuid)
            )
        `)

        // Historial de estados
        await queryRunner.query(`
            CREATE TABLE incendio_estado_historial (
                historial_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                estado_incendio_uuid uuid NOT NULL,
                cambiado_por uuid,
                observacion text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_historial_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_historial_estado_uuid
                    FOREIGN KEY (estado_incendio_uuid) REFERENCES estado_incendio(estado_incendio_uuid),
                CONSTRAINT fk_historial_cambiado_por
                    FOREIGN KEY (cambiado_por) REFERENCES usuarios(usuario_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_historial_incendio_fecha
            ON incendio_estado_historial (incendio_uuid, creado_en)
        `)

        // Zonas afectadas
        await queryRunner.query(`
            CREATE TABLE zonas_afectadas (
                zona_afectada_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                geom geometry(MultiPolygon, 4326) NOT NULL,
                fecha date NOT NULL,
                fuente text,
                metodo text,
                area_ha numeric,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_zonas_afectadas_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_zonas_afectadas_incendio_fecha
            ON zonas_afectadas (incendio_uuid, fecha)
        `)

        // Fotos (apuntando a incendio, NO a reporte)
        await queryRunner.query(`
            CREATE TABLE fotos_reporte (
                foto_reporte_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                url text NOT NULL,
                credito text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_fotos_reporte_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid) ON DELETE CASCADE
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_fotos_reporte_incendio
            ON fotos_reporte (incendio_uuid)
        `)

        // Puntos de calor (con índice único en hash_dedupe)
        await queryRunner.query(`
            CREATE TABLE puntos_calor (
                punto_calor_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid,
                fuente text NOT NULL,
                instrument text NOT NULL,
                satellite text NOT NULL,
                version text,
                acq_date date NOT NULL,
                acq_time integer NOT NULL,
                daynight text,
                confidence numeric,
                frp numeric,
                brightness numeric,
                bright_ti4 numeric,
                bright_ti5 numeric,
                scan numeric,
                track numeric,
                geom geometry(Point, 4326) NOT NULL,
                region text,
                hash_dedupe text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_puntos_calor_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_puntos_calor_fecha
            ON puntos_calor (acq_date)
        `)

        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_puntos_calor_hash_dedupe
            ON puntos_calor (hash_dedupe)
            WHERE hash_dedupe IS NOT NULL
        `)

        // ========== CIERRE DINÁMICO ==========

        // Plantillas de cierre
        await queryRunner.query(`
            CREATE TABLE cierre_plantillas (
                plantilla_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL,
                descripcion text,
                activa boolean NOT NULL DEFAULT false,
                version integer NOT NULL DEFAULT 1,
                creado_por_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_plantillas_creado_por
                    FOREIGN KEY (creado_por_uuid) REFERENCES usuarios(usuario_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_plantillas_activa
            ON cierre_plantillas (activa)
            WHERE eliminado_en IS NULL
        `)

        // Secciones de plantilla
        await queryRunner.query(`
            CREATE TABLE cierre_secciones (
                seccion_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                plantilla_uuid uuid NOT NULL,
                nombre text NOT NULL,
                descripcion text,
                orden integer NOT NULL,
                icono text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_secciones_plantilla
                    FOREIGN KEY (plantilla_uuid) REFERENCES cierre_plantillas(plantilla_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_secciones_plantilla
            ON cierre_secciones (plantilla_uuid)
            WHERE eliminado_en IS NULL
        `)

        // Campos de formulario (con soporte jerárquico)
        await queryRunner.query(`
            CREATE TABLE cierre_campos (
                campo_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                seccion_uuid uuid NOT NULL,
                campo_padre_uuid uuid,
                nombre text NOT NULL,
                descripcion text,
                placeholder text,
                tipo text NOT NULL,
                orden integer NOT NULL,
                requerido boolean NOT NULL DEFAULT false,
                opciones jsonb,
                validaciones jsonb,
                dependencias jsonb,
                unidad text,
                ayuda text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_campos_seccion
                    FOREIGN KEY (seccion_uuid) REFERENCES cierre_secciones(seccion_uuid),
                CONSTRAINT fk_cierre_campos_campo_padre
                    FOREIGN KEY (campo_padre_uuid) REFERENCES cierre_campos(campo_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_campos_seccion
            ON cierre_campos (seccion_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_campos_campo_padre
            ON cierre_campos (campo_padre_uuid)
            WHERE eliminado_en IS NULL AND campo_padre_uuid IS NOT NULL
        `)

        // Respuestas de usuarios
        await queryRunner.query(`
            CREATE TABLE cierre_respuestas (
                respuesta_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                campo_uuid uuid NOT NULL,
                valor_texto text,
                valor_numero numeric,
                valor_fecha date,
                valor_datetime timestamptz,
                valor_boolean boolean,
                valor_json jsonb,
                respondido_por_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_respuestas_incendio
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_cierre_respuestas_campo
                    FOREIGN KEY (campo_uuid) REFERENCES cierre_campos(campo_uuid),
                CONSTRAINT fk_cierre_respuestas_respondido_por
                    FOREIGN KEY (respondido_por_uuid) REFERENCES usuarios(usuario_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_respuestas_incendio
            ON cierre_respuestas (incendio_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_respuestas_campo
            ON cierre_respuestas (campo_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_cierre_respuestas_incendio_campo
            ON cierre_respuestas (incendio_uuid, campo_uuid)
            WHERE eliminado_en IS NULL
        `)

        // Eventos operativos
        await queryRunner.query(`
            CREATE TABLE cierre_eventos_operativos (
                evento_operativo_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                tipo_evento text NOT NULL,
                categoria text NOT NULL,
                recurso_id text,
                ocurrio_en timestamptz NOT NULL,
                nota text,
                creado_por uuid,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_eventos_operativos_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_eventos_operativos_creado_por
                    FOREIGN KEY (creado_por) REFERENCES usuarios(usuario_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_eventos_operativos_incendio_fecha
            ON cierre_eventos_operativos (incendio_uuid, ocurrio_en)
        `)

        // ========== ACTUALIZACIONES ==========

        await queryRunner.query(`
            CREATE TABLE actualizaciones (
                actualizacion_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                tipo text NOT NULL,
                descripcion_corta text,
                creado_por uuid,
                historial_uuid uuid,
                foto_reporte_uuid uuid,
                responsable_incendio_uuid uuid,
                zona_afectada_uuid uuid,
                punto_calor_uuid uuid,
                evento_operativo_uuid uuid,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_actualizaciones_incendio_uuid
                    FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_actualizaciones_creado_por
                    FOREIGN KEY (creado_por) REFERENCES usuarios(usuario_uuid),
                CONSTRAINT fk_actualizaciones_historial_uuid
                    FOREIGN KEY (historial_uuid) REFERENCES incendio_estado_historial(historial_uuid),
                CONSTRAINT fk_actualizaciones_foto_reporte_uuid
                    FOREIGN KEY (foto_reporte_uuid) REFERENCES fotos_reporte(foto_reporte_uuid),
                CONSTRAINT fk_actualizaciones_responsable_uuid
                    FOREIGN KEY (responsable_incendio_uuid) REFERENCES incendio_registro_responsable(incendio_uuid),
                CONSTRAINT fk_actualizaciones_zona_uuid
                    FOREIGN KEY (zona_afectada_uuid) REFERENCES zonas_afectadas(zona_afectada_uuid),
                CONSTRAINT fk_actualizaciones_punto_calor_uuid
                    FOREIGN KEY (punto_calor_uuid) REFERENCES puntos_calor(punto_calor_uuid),
                CONSTRAINT fk_actualizaciones_evento_operativo_uuid
                    FOREIGN KEY (evento_operativo_uuid) REFERENCES cierre_eventos_operativos(evento_operativo_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_actualizaciones_creado_en
            ON actualizaciones (creado_en)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_actualizaciones_incendio_fecha
            ON actualizaciones (incendio_uuid, creado_en)
        `)

        // ========== NOTIFICACIONES ==========

        await queryRunner.query(`
            CREATE TABLE notificaciones (
                notificacion_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                usuario_uuid uuid NOT NULL,
                titulo varchar(255) NOT NULL,
                mensaje text NOT NULL,
                tipo varchar(50),
                payload jsonb,
                leida_en timestamptz,
                creado_en timestamptz NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_notif_usuario
            ON notificaciones (usuario_uuid, creado_en)
        `)

        // Push notifications
        await queryRunner.query(`
            CREATE TABLE user_push_prefs (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id varchar(64) NOT NULL UNIQUE,
                municipios_suscritos text[] NOT NULL DEFAULT '{}',
                departamentos_suscritos text[] NOT NULL DEFAULT '{}',
                avisarme_aprobado boolean NOT NULL DEFAULT true,
                avisarme_actualizaciones boolean NOT NULL DEFAULT true,
                avisarme_cierres boolean NOT NULL DEFAULT true,
                extra jsonb,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_user_push_prefs_user_id
            ON user_push_prefs (user_id)
        `)

        await queryRunner.query(`
            CREATE TABLE user_push_tokens (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                token varchar(255) NOT NULL UNIQUE,
                user_id varchar(64) NOT NULL,
                prefs_id uuid NOT NULL,
                active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_user_push_tokens_prefs
                    FOREIGN KEY (prefs_id) REFERENCES user_push_prefs(id) ON DELETE CASCADE ON UPDATE CASCADE
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_user_push_token_token
            ON user_push_tokens (token)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_user_push_token_user_id
            ON user_push_tokens (user_id)
        `)

        // ========== AUDITORÍA ==========

        await queryRunner.query(`
            CREATE TABLE auditoria_eventos (
                auditoria_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                tabla text NOT NULL,
                registro_id text NOT NULL,
                accion text NOT NULL,
                antes jsonb,
                despues jsonb,
                usuario_uuid uuid,
                ip text,
                user_agent text,
                creado_en timestamptz NOT NULL DEFAULT now()
            )
        `)

        // Job runs
        await queryRunner.query(`
            CREATE TABLE job_runs (
                job_run_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre_job text NOT NULL,
                inicio timestamptz NOT NULL,
                fin timestamptz,
                status text NOT NULL,
                insertados integer NOT NULL DEFAULT 0,
                ignorados integer NOT NULL DEFAULT 0,
                asociados integer NOT NULL DEFAULT 0,
                errores jsonb,
                creado_en timestamptz NOT NULL DEFAULT now()
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_job_runs
            ON job_runs (nombre_job, inicio)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop en orden inverso para respetar FKs
        await queryRunner.query(`DROP TABLE IF EXISTS job_runs CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS auditoria_eventos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS user_push_tokens CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS user_push_prefs CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS notificaciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS actualizaciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_eventos_operativos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_respuestas CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_campos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_secciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_plantillas CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS puntos_calor CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS fotos_reporte CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS zonas_afectadas CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS incendio_estado_historial CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS incendio_registro_responsable CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS info_falsa_incendio CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS incendio_seguidores CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS incendios CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS medios CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS estado_incendio CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS municipios CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS departamentos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS usuarios CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS instituciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS roles CASCADE`)
        await queryRunner.query(`DROP EXTENSION IF EXISTS pgcrypto`)
        await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`)
        await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`)
    }
}
