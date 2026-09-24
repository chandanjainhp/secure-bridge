import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from "framer-motion";
/* eslint-disable-next-line no-unused-vars */
import { Bot, Edit2, Loader2 } from "lucide-react";
/* eslint-disable-next-line no-unused-vars */
import { Button } from "@/shared/components/ui/button";
/* eslint-disable-next-line no-unused-vars */
import { Input } from "@/shared/components/ui/input";
/* eslint-disable-next-line no-unused-vars */
import { Label } from "@/shared/components/ui/label";
/* eslint-disable-next-line no-unused-vars */
import { Textarea } from "@/shared/components/ui/textarea";
/* eslint-disable-next-line no-unused-vars */
import { Slider } from "@/shared/components/ui/slider";
/* eslint-disable-next-line no-unused-vars */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
/* eslint-disable-next-line no-unused-vars */
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useProjectsStore } from "@/features/projects";
import { useToast } from "@/shared/hooks/useToast";
import { fetchAvailableModels } from "@/features/chat/api/availableModels";

const editProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  // Model list is dynamic (depends on the user's configured keys), so a plain
  // non-empty string is enforced here; the select only offers real options.
  model: z.string().min(1, "Please select a valid AI model"),
  temperature: z
    .number()
    .min(0, "Temperature must be between 0 and 1")
    .max(1, "Temperature must be between 0 and 1"),
  maxTokens: z
    .number()
    .int("Max tokens must be a whole number")
    .min(256, "Max tokens must be at least 256")
    .max(8192, "Max tokens cannot exceed 8192"),
  systemPrompt: z
    .string()
    .min(1, "System prompt is required")
    .max(4000, "System prompt must be less than 4000 characters"),
  coreMemory: z
    .string()
    .max(10000, "Core memory must be less than 10000 characters")
    .optional()
    .or(z.literal("")),
});

const fallbackOption = (value) => ({
  value,
  label: value === "local" ? "Local model (currently unavailable)" : value,
  description: "Previously selected — no longer in your configured providers",
  group: "OTHER",
});

export function EditProjectModal({ project, children, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const { updateProject } = useProjectsStore();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      model: project?.model || "local",
      temperature: project?.temperature ?? 0.7,
      maxTokens: project?.maxTokens || 2048,
      systemPrompt: project?.systemPrompt || "You are a helpful AI assistant.",
      coreMemory: project?.coreMemory || "",
    },
  });

  const temperature = watch("temperature");
  const model = watch("model");
  const coreMemory = watch("coreMemory");

  // Load the models this user can actually use when the dialog opens. The
  // project's current model stays selectable even if its key was removed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelsLoading(true);
    fetchAvailableModels()
      .then((options) => {
        if (cancelled) return;
        const current = project?.model;
        if (current && !options.some((m) => m.value === current)) {
          options = [fallbackOption(current), ...options];
        }
        setModels(options);
      })
      .catch(() => {
        if (!cancelled) {
          setModels(project?.model ? [fallbackOption(project.model)] : []);
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project?.model]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("📝 [EditProjectModal] Updating project:", project.id);

      await updateProject(project.id, {
        name: data.name,
        description: data.description,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        systemPrompt: data.systemPrompt,
        coreMemory: data.coreMemory,
      });

      console.log("✅ [EditProjectModal] Project updated successfully");
      toast({
        title: "Project updated!",
        description: `${data.name} has been updated.`,
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("❌ [EditProjectModal] Error:", error);
      // Already toasted centrally for API failures.
      if (!error?.toastShown) {
        toast({
          title: "Failed to update project",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline" className="gap-2">
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <AnimatePresence>
        {open && (
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Edit2 className="w-4 h-4 text-primary" />
                  </div>
                  Edit Project
                </DialogTitle>
                <DialogDescription>
                  Update your AI agent configuration and core memory settings.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6 mt-4"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Customer Support Bot"
                      {...register("name")}
                      className={errors.name ? "border-destructive" : ""}
                      maxLength={100}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What does this agent do?"
                      rows={2}
                      {...register("description")}
                      maxLength={500}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>AI Model *</Label>
                    {modelsLoading ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading models…
                      </div>
                    ) : (
                      <Select
                        value={model}
                        onValueChange={(value) => setValue("model", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const groups = models.reduce((acc, m) => {
                              (acc[m.group] ||= []).push(m);
                              return acc;
                            }, {});
                            return Object.entries(groups).map(
                              ([groupName, items]) => (
                                <SelectGroup key={groupName}>
                                  <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                    {groupName}
                                  </SelectLabel>
                                  {items.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      <div className="flex flex-col">
                                        <span className="flex items-center gap-2">
                                          {m.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {m.description}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ),
                            );
                          })()}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Temperature (0.0 - 1.0) *</Label>
                      <span className="text-lg font-semibold text-primary">
                        {temperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={([value]) =>
                        setValue("temperature", value)
                      }
                      min={0}
                      max={1}
                      step={0.1}
                      className="cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max Tokens *</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min={256}
                      max={8192}
                      {...register("maxTokens", { valueAsNumber: true })}
                      className={errors.maxTokens ? "border-destructive" : ""}
                    />
                    {errors.maxTokens && (
                      <p className="text-sm text-destructive">
                        {errors.maxTokens.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">System Prompt *</Label>
                    <Textarea
                      id="systemPrompt"
                      placeholder="Define your AI agent's behavior and personality..."
                      rows={4}
                      {...register("systemPrompt")}
                      className={
                        errors.systemPrompt ? "border-destructive" : ""
                      }
                      maxLength={4000}
                    />
                    {errors.systemPrompt && (
                      <p className="text-sm text-destructive">
                        {errors.systemPrompt.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Label
                      htmlFor="coreMemory"
                      className="flex items-center gap-2"
                    >
                      <span>🧠 Core Memory (Auto-Updated)</span>
                    </Label>
                    <Textarea
                      id="coreMemory"
                      placeholder="Your agent's learned facts and preferences will appear here automatically as you chat. You can manually add or edit facts here too."
                      rows={4}
                      {...register("coreMemory")}
                      className={errors.coreMemory ? "border-destructive" : ""}
                      maxLength={10000}
                    />
                    {errors.coreMemory && (
                      <p className="text-sm text-destructive">
                        {errors.coreMemory.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Optional. Max 10000 characters. This memory is
                      automatically updated from conversations. Each fact should
                      be on a new line starting with •
                    </p>
                    {coreMemory && (
                      <div className="mt-2 p-3 bg-muted rounded text-sm">
                        <p className="text-xs font-semibold mb-1">
                          Memory Summary:
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {coreMemory}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2" />
                        Update Project
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
