import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchByName } from "@/lib/assignments";

export interface PickItem {
  id: string;
  name: string;
  /** 이름 옆 작은 글씨 (역할, 담당 환자 수 등) */
  hint?: string;
}

/**
 * 이름으로 찾아서 고르는 작은 창 (담당자 추가·환자 추가에 씀).
 * 사람이 많아도 쓰도록 목록 대신 검색을 먼저 보여 준다.
 */
export function NamePicker({
  items,
  exclude = [],
  onPick,
  label,
  placeholder = "이름으로 찾기",
  trigger,
  disabled = false,
}: {
  items: PickItem[];
  exclude?: string[];
  onPick: (id: string) => void;
  /** 버튼 글자 (trigger가 없을 때) */
  label: string;
  placeholder?: string;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const found = searchByName(items, q, exclude);
  const shown = found.slice(0, 50);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" disabled={disabled}>
            <Plus className="size-3.5" /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9" />
        <ul className="mt-2 max-h-64 overflow-y-auto" role="listbox" aria-label={label}>
          {shown.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">맞는 이름이 없습니다.</li>}
          {shown.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(i.id);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{i.name}</span>
                {i.hint && <span className="text-xs text-muted-foreground">{i.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        {found.length > shown.length && <p className="px-2 pt-1 text-xs text-muted-foreground">{found.length - shown.length}명 더 있음. 이름을 더 입력해 주세요.</p>}
      </PopoverContent>
    </Popover>
  );
}
