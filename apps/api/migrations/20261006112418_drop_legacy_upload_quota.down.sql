CREATE TYPE user_upload_quota_record_action AS ENUM ('ADD', 'SUB', 'USE');
CREATE TYPE user_upload_quota_record_field AS ENUM ('SIZE', 'USED');
CREATE TYPE user_upload_quota_record_status AS ENUM ('COMPLETED', 'WITHDRAWN');

CREATE TABLE user_upload_quotas (
    id serial PRIMARY KEY,
    size bigint NOT NULL,
    used bigint NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL,
    is_first_grant boolean DEFAULT false NOT NULL
);
CREATE UNIQUE INDEX user_upload_quotas_user_id_key ON user_upload_quotas USING btree (user_id);

CREATE TABLE user_upload_quota_records (
    id serial PRIMARY KEY,
    field user_upload_quota_record_field NOT NULL,
    amount bigint NOT NULL,
    action user_upload_quota_record_action NOT NULL,
    action_reason character varying(255),
    status user_upload_quota_record_status DEFAULT 'COMPLETED' NOT NULL,
    upload_session_id integer REFERENCES game_upload_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL,
    user_upload_quota_id integer NOT NULL REFERENCES user_upload_quotas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated timestamp(3) without time zone NOT NULL
);
CREATE UNIQUE INDEX user_upload_quota_records_upload_session_id_key ON user_upload_quota_records USING btree (upload_session_id);

INSERT INTO user_upload_quotas (size, used, user_id, updated)
SELECT 0, 0, id, CURRENT_TIMESTAMP FROM users;
