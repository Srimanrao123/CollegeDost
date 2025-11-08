import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface ProfileCompletionProgressProps {
  profile: {
    full_name?: string;
    avatar_url?: string;
    bio?: string;
    state?: string;
    entrance_exam?: string[];
  };
}

export function ProfileCompletionProgress({ profile }: ProfileCompletionProgressProps) {
  const fields = [
    { key: 'full_name', label: 'Full Name', value: profile.full_name },
    { key: 'avatar_url', label: 'Profile Picture', value: profile.avatar_url },
    { key: 'bio', label: 'Bio', value: profile.bio },
    { key: 'state', label: 'State', value: profile.state },
    { key: 'entrance_exam', label: 'Entrance Exam', value: profile.entrance_exam && profile.entrance_exam.length > 0 ? profile.entrance_exam.join(', ') : '' },
  ];

  const completedFields = fields.filter(field => field.value && field.value.toString().trim() !== '').length;
  const totalFields = fields.length;
  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  if (completionPercentage === 100) {
    return null; // Hide when profile is complete
  }

  return (
    <Card className="p-4 mb-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Profile Completion</h3>
          <span className="text-sm text-muted-foreground">
            {completionPercentage}%
          </span>
        </div>
        <Progress value={completionPercentage} className="h-2" />
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.key} className="flex items-center gap-2 text-sm">
              <CheckCircle2
                className={`h-4 w-4 ${
                  field.value && field.value.toString().trim() !== ''
                    ? 'text-green-500'
                    : 'text-muted-foreground'
                }`}
              />
              <span
                className={
                  field.value && field.value.toString().trim() !== ''
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }
              >
                {field.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
