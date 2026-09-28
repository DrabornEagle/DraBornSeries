-- Preserve the previously exposed public and graphql_public schemas.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, drabornseries';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
