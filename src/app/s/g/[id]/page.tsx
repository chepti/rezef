import { Suspense } from "react";
import StudentGroup from "@/components/StudentGroup";

async function GroupLoader({ params }: { params: PageProps<"/s/g/[id]">["params"] }) {
  const { id } = await params;
  return <StudentGroup groupId={Number(id)} />;
}

export default function StudentGroupPage(props: PageProps<"/s/g/[id]">) {
  return (
    <Suspense fallback={<div className="p-10 text-muted">טוענים…</div>}>
      <GroupLoader params={props.params} />
    </Suspense>
  );
}
