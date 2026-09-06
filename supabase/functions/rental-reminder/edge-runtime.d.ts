declare namespace Deno {
  namespace Env {
    function get(name: string): string | undefined;
  }

  const env: typeof Env;

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): unknown;
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient<T = unknown>(url: string, key: string): any;
}
