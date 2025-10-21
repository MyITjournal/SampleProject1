--DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users
(
    _id uuid NOT NULL DEFAULT gen_random_uuid(),
    firstname character varying(25) COLLATE pg_catalog."default" NOT NULL,
    middlename character varying(25) COLLATE pg_catalog."default",
    lastname character varying(25) COLLATE pg_catalog."default" NOT NULL,
    email character varying(25) COLLATE pg_catalog."default" NOT NULL,
    "dateOfBirth" date NOT NULL,
    created timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_Email" PRIMARY KEY (email)
)