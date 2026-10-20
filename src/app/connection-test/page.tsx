import { createClient } from "@/lib/supabase/server";

export default async function ConnectionTestPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fakultas")
    .select("fakultas_id, nama_fakultas")
    .limit(20);

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>NEXUS Supabase Connection Test</h1>

      {error ? (
        <>
          <h2>Query Error</h2>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </>
      ) : (
        <>
          <h2>Supabase Connected</h2>
          <p>Jumlah fakultas yang terbaca: {data?.length ?? 0}</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </>
      )}
    </main>
  );
}
