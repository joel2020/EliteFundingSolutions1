# AI Analysis Add-on Notes

## Current status

AI analysis is not live in the CRM. Repository review found no AI provider package, no AI API route, no generated-analysis storage table, and no backend path that sends real deal/application data to an AI model.

The deal detail page now includes a placeholder-ready AI Analysis panel. It uses existing CRM records only for simple readiness signals and is clearly labeled `AI analysis not connected yet`.

## Required to make AI analysis live

1. API key/provider

Choose a provider and add the server-only environment variable, for example `OPENAI_API_KEY`. Do not expose provider keys through `NEXT_PUBLIC_*` variables.

2. Data inputs

Define the exact fields sent to the model, such as deal stage, application status, requested amount, business profile, revenue, time in business, NSF count, negative days, document inventory, lender submissions, offers, notes, and risk events. Mask or omit unnecessary SSN, EIN, DOB, and owner PII.

3. Prompt/schema

Create a stable prompt and structured output schema for funding readiness score, risk summary, missing documents, red flags, suggested next steps, file completeness score, and underwriter notes. The schema should make clear that results are decision support, not automated approval.

4. Storage table

Add a table such as `deal_ai_analyses` with `organization_id`, `deal_id`, `application_id`, input snapshot metadata, model/provider, structured result JSON, status, error message, created_by, created_at, and updated_at. Enable RLS and restrict access to authorized CRM roles.

5. Button/trigger

Add a CRM action such as `Run AI Analysis` on the deal detail page. The action should call a protected server route, create an analysis record, and refresh the panel when complete. Consider manual rerun controls and stale-result warnings.

6. Error handling

Handle missing provider keys, invalid input, provider timeouts, rate limits, malformed model output, storage failures, and authorization failures with user-friendly messages. Never fail the core deal page if analysis fails.

7. Cost/rate-limit considerations

Limit analysis runs by role, organization, and deal. Add debouncing or cooldowns, track token/model cost per run, and log provider errors. Consider caching results and requiring a manual rerun after major deal/application/document changes.

## Security notes

- Keep provider calls server-side only.
- Avoid sending full SSN, EIN, DOB, document URLs, or raw file contents unless the client explicitly approves that scope.
- Store the exact data snapshot or a sanitized summary used for the analysis so staff can audit what the model saw.
- Label outputs as internal funding review support until the business approves final compliance language.
