import { Card, CardDescription, CardHeader, CardTitle } from "@/renderer/components/ui/card";

export function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}
