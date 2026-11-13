import { Suspense } from "react";
import SharedSequence from "@/components/SharedSequence";

async function Loader({ params }: { params: PageProps<"/shared/[id]">["params"] }) {
  const { id } = await params;
  return <SharedSequence groupId={Number(id)} />;
}

export default function SharedPage(props: PageProps<"/shared/[id]">) {
  return (
    <Suspense fallback={<div className="p-10 text-muted">טוענים…</div>}>
      <Loader params={props.params} />
    </Suspense>
  );
}
