ALTER TABLE "asset_versions" DROP CONSTRAINT "asset_versions_production_source_check", ADD CONSTRAINT "asset_versions_production_source_check" CHECK ("production_source" IN ('unknown', 'user_reported_provider', 'connected_provider'));
--> statement-breakpoint
CREATE FUNCTION public.sanitize_provider_generation_parameter_value(input_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
	result jsonb;
	entry record;
	cleaned jsonb;
	key_normalized text;
	text_value text;
	parsed_value jsonb;
BEGIN
	IF input_value IS NULL THEN
		RETURN NULL;
	END IF;

	CASE jsonb_typeof(input_value)
		WHEN 'object' THEN
			result := '{}'::jsonb;
			FOR entry IN SELECT key, value FROM jsonb_each(input_value) LOOP
				key_normalized := regexp_replace(lower(entry.key), '[^a-z0-9]', '', 'g');
				IF key_normalized IN (
					'accesskey', 'accesstoken', 'apikey', 'auth', 'authheader',
					'authorization', 'authorizationheader', 'authdata', 'clientsecret',
					'cookie', 'cookies', 'credential', 'credentials', 'key', 'password',
					'privatekey', 'refreshtoken', 'signature', 'secret', 'secretkey',
					'session', 'sessionid', 'securitytoken', 'token'
				)
				OR key_normalized LIKE '%accesskey%'
				OR key_normalized LIKE '%apikey%'
				OR key_normalized LIKE '%authdata%'
				OR key_normalized LIKE '%authheader%'
				OR key_normalized LIKE '%authtoken%'
				OR key_normalized LIKE '%authorization%'
				OR key_normalized LIKE '%cookie%'
				OR key_normalized LIKE '%clientsecret%'
				OR key_normalized LIKE '%session%'
				OR key_normalized LIKE '%signature%'
				OR key_normalized LIKE '%token'
				OR key_normalized LIKE '%secret%'
				OR key_normalized LIKE '%credential%'
				OR key_normalized LIKE '%password%'
				OR key_normalized LIKE '%privatekey%'
				OR key_normalized ~ '^(access|asset|download|file|image|output|preview|result|signed|temporary)[a-z0-9]*(url|uri)$'
				THEN
					CONTINUE;
				END IF;

				cleaned := public.sanitize_provider_generation_parameter_value(entry.value);
				IF cleaned IS NOT NULL THEN
					result := result || jsonb_build_object(entry.key, cleaned);
				END IF;
			END LOOP;
			RETURN result;
		WHEN 'array' THEN
			result := '[]'::jsonb;
			FOR entry IN SELECT value FROM jsonb_array_elements(input_value) LOOP
				cleaned := public.sanitize_provider_generation_parameter_value(entry.value);
				IF cleaned IS NOT NULL THEN
					result := result || jsonb_build_array(cleaned);
				END IF;
			END LOOP;
			RETURN result;
		WHEN 'string' THEN
			text_value := input_value #>> '{}';
			IF left(ltrim(text_value), 1) IN ('{', '[', '"') THEN
				BEGIN
					parsed_value := text_value::jsonb;
				EXCEPTION WHEN others THEN
					parsed_value := NULL;
				END;
				IF parsed_value IS NOT NULL THEN
					cleaned := public.sanitize_provider_generation_parameter_value(parsed_value);
					IF cleaned IS DISTINCT FROM parsed_value THEN
						IF cleaned IS NULL OR cleaned = '{}'::jsonb OR cleaned = '[]'::jsonb THEN
							RETURN NULL;
						END IF;
						RETURN to_jsonb(cleaned::text);
					END IF;
				END IF;
			END IF;

			IF text_value ~* '^(bearer|basic)[[:space:]]+[^[:space:]]+$'
			OR text_value ~* '^(https?://[^/?#]*:[^@/?#]*@)'
			OR text_value ~* '[?&](?:[^=&]*(signature|credential|accesskey|accesstoken|token)|sig|expires|x-amz-[^=]*)='
			OR text_value ~* '(^|[\r\n,;{])[[:space:]]*["'']?(authorization|proxy-authorization|cookie|set-cookie|[a-z0-9-]*(api-key|access-token|auth-token|security-token|session-token))["'']?[[:space:]]*:[[:space:]]*["'']?[^[:space:]]+'
			THEN
				RETURN NULL;
			END IF;
			RETURN input_value;
		ELSE
			RETURN input_value;
	END CASE;
END;
$function$;
--> statement-breakpoint
UPDATE provider_generation_records
SET parameter_snapshot = jsonb_set(
	parameter_snapshot,
	'{parameters}',
	public.sanitize_provider_generation_parameter_value(parameter_snapshot->'parameters'),
	true
)
WHERE parameter_snapshot ? 'parameters'
	AND parameter_snapshot->'parameters' IS DISTINCT FROM
		public.sanitize_provider_generation_parameter_value(parameter_snapshot->'parameters');
--> statement-breakpoint
DROP FUNCTION public.sanitize_provider_generation_parameter_value(jsonb);
