import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";

interface ChecklistItem {
  item: string;
  completed: boolean;
  quantity?: number;
}

interface ChecklistProps {
  title: string;
  items: ChecklistItem[];
  onUpdate: (items: ChecklistItem[]) => void;
  showQuantity?: boolean;
}

const Checklist = ({ title, items, onUpdate, showQuantity = false }: ChecklistProps) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(items);

  const totalItems = checklist.length;
  const completedItems = checklist.filter(item => item.completed).length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const handleToggle = (index: number) => {
    const updatedChecklist = checklist.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);
    onUpdate(updatedChecklist);
  };

  if (totalItems === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            {title}
            <Badge variant="outline" className="ml-2">No items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No checklist items for this job.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={progress === 100 ? "default" : "secondary"}>
            {completedItems}/{totalItems}
          </Badge>
        </div>
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {progress === 100 ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </span>
            ) : (
              `${Math.round(progress)}% complete`
            )}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={`${title}-${index}`}
                checked={item.completed}
                onCheckedChange={() => handleToggle(index)}
                className="mt-0.5"
              />
              <label
                htmlFor={`${title}-${index}`}
                className="flex-1 text-sm cursor-pointer"
              >
                <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                  {item.item.trim()}
                </span>
                {showQuantity && item.quantity && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Qty: {item.quantity})
                  </span>
                )}
              </label>
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Checklist;
