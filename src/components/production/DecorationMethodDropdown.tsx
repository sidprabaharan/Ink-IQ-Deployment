import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DecorationMethodDropdownProps {
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  methods?: Array<{ value: string; label: string }>;
}

const defaultDecorationMethods = [
  { value: 'screen_printing', label: 'Screen Printing' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'dtf', label: 'DTF' },
  { value: 'dtg', label: 'DTG' },
] as const;

export function DecorationMethodDropdown({ selectedMethod, onMethodChange, methods }: DecorationMethodDropdownProps) {
  const options = methods && methods.length ? methods : (defaultDecorationMethods as any);
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-foreground whitespace-nowrap">
        Decoration Method:
      </label>
      <Select value={selectedMethod} onValueChange={(value) => onMethodChange(value)}>
        <SelectTrigger className="w-48 bg-background border-border">
          <SelectValue placeholder="Select method" />
        </SelectTrigger>
        <SelectContent className="bg-background border-border z-50">
          {options.map((method) => (
            <SelectItem 
              key={method.value} 
              value={method.value}
              className="hover:bg-muted focus:bg-muted"
            >
              {method.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}