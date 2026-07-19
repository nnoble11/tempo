import { BriefingLoader } from "../../../src/BriefingLoader";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ briefingId: string }>;
}) {
  const { briefingId } = await params;
  return <BriefingLoader briefingId={briefingId} />;
}
