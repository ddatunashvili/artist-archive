import type { Metadata } from "next";
import { ImportWorkflow } from "@/components/ImportWorkflow";
import { describeProvider } from "@/lib/ai";

export const metadata: Metadata = { title: "Import CV" };
export const dynamic = "force-dynamic";

export default function ImportPage() {
  // Provider name and model only - the key never leaves the server.
  const provider = describeProvider();

  return (
    <>
      <h1>Import a CV</h1>
      <p className="lede">
        Paste unstructured CV text. The extractor proposes structured records; you correct and
        approve them before anything is written to the archive.
      </p>
      <ImportWorkflow provider={provider} />
    </>
  );
}
