import { Suspense } from "react";
import Board from "@/components/Board";

async function BoardLoader({ params }: { params: PageProps<"/g/[id]">["params"] }) {
  const { id } = await params;
  return <Board groupId={Number(id)} />;
}

export default function GroupPage(props: PageProps<"/g/[id]">) {
  return (
    <Suspense fallback={<div className="p-10 text-muted">טוענים…</div>}>
      <BoardLoader params={props.params} />
    </Suspense>
  );
}
