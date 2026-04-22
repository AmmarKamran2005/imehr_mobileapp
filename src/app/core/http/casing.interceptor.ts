import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * The IMEHR backend serializes JSON in PascalCase
 * (Program.cs: `PropertyNamingPolicy = null`). Our TypeScript DTOs are
 * camelCase, which is Angular's convention. This interceptor walks every
 * JSON response body and lowercases the first letter of each key so app
 * code can use idiomatic camelCase without per-call mappers.
 *
 * – Only runs on `application/json` (or empty Content-Type) responses.
 * – Keys are transformed; values are left untouched so enum strings,
 *   provider names etc. aren't mangled.
 * – Arrays and nested objects are handled recursively.
 */
export const casingInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;
      const ct = event.headers.get('content-type') ?? '';
      if (ct && !ct.toLowerCase().includes('json')) return event;
      const body = event.body;
      if (body == null || typeof body !== 'object') return event;
      return event.clone({ body: camelizeKeys(body) });
    }),
  );
};

function camelizeKeys(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(camelizeKeys);
  }
  if (input && typeof input === 'object' && input.constructor === Object) {
    const src = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) {
      out[lowerFirst(k)] = camelizeKeys(src[k]);
    }
    return out;
  }
  return input;
}

function lowerFirst(k: string): string {
  if (!k) return k;
  // Preserve acronym heads like "MRN", "DOB", "BMI" → "mrn", "dob", "bmi".
  // Strict "lower the first char" is enough; cached acronyms aren't worth
  // the complexity and backend's PascalCase conventions rarely run two
  // acronyms together in field names.
  return k.charAt(0).toLowerCase() + k.slice(1);
}
