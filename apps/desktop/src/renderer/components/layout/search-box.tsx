import { Input } from "antd";
import { Search } from "lucide-react";

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
    <div className="sidebar-search">
      <Input
        allowClear
        prefix={<Search size={15} />}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
