import { Search } from "lucide-react";

import { Input } from "@/renderer/components/ui/input";

export function SearchBox({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className="relative p-3">
      <Search className="text-muted-foreground absolute top-1/2 left-5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        placeholder={placeholder}
        className="pl-8"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
