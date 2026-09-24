import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Loader2, Bot, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Slider } from "@/shared/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
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
import { cn } from "@/shared/utils/utils";

const projectSchema = z.object({
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
});

export function CreateProjectModal({ children, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const { createProject } = useProjectsStore();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      model: "",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt:
        "You are a helpful AI assistant. Be professional, accurate, and concise in your responses.",
    },
  });

  const temperature = watch("temperature");
  const model = watch("model");

  // Load the models this user can actually use (keys configured in Settings,
  // plus the local connection when it is online).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelsLoading(true);
    fetchAvailableModels()
      .then((options) => {
        if (cancelled) return;
        setModels(options);
        if (options.length) setValue("model", options[0].value);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, setValue]);

  // Group options for the dropdown: LOCAL, OpenAI, Google, Anthropic
  const groups = models.reduce((acc, m) => {
    (acc[m.group] ||= []).push(m);
    return acc;
  }, {});

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const created = await createProject({
        name: data.name,
        description: data.description,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        systemPrompt: data.systemPrompt,
      });
      toast({
        title: "PROJECT CREATED",
        description: `${data.name} is ready to use.`,
      });
      setOpen(false);
      reset();
      // Hand the created project to the caller (it may navigate to its chat).
      onSuccess?.(created);
    } catch (error) {
      // Already toasted centrally for API failures.
      if (!error?.toastShown) {
        toast({
          title: "FAILED TO CREATE",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2 font-mono tracking-[0.1em] text-[11px] uppercase">
            <Plus className="w-4 h-4" />
            NEW PROJECT
          </Button>
        )}
      </DialogTrigger>
      <AnimatePresence>
        {open && (
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto bg-background border-2 border-primary text-foreground p-0 rounded-none shadow-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader className="mb-6 pb-6 border-b-2 border-primary">
                <DialogTitle className="flex items-center gap-3 font-display text-[24px]">
                  <div className="w-8 h-8 bg-background border-2 border-primary flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  CREATE NEW PROJECT
                </DialogTitle>
                <DialogDescription className="font-body text-[14px] text-muted-foreground mt-2">
                  Set up a new AI agent with custom model and prompt
                  configuration.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold"
                    >
                      PROJECT NAME
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g., Customer Support Bot"
                      {...register("name")}
                      className={cn(
                        "border-2 border-primary rounded-none h-10",
                        errors.name ? "border-destructive" : "",
                      )}
                      maxLength={100}
                    />
                    {errors.name && (
                      <p className="text-[11px] font-mono text-destructive uppercase">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold"
                    >
                      DESCRIPTION
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="What does this agent do? What's its purpose?"
                      rows={2}
                      {...register("description")}
                      className={cn(
                        "border-2 border-primary rounded-none resize-none",
                        errors.description ? "border-destructive" : "",
                      )}
                      maxLength={500}
                    />
                    {errors.description && (
                      <p className="text-[11px] font-mono text-destructive uppercase">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold">
                      AI MODEL
                    </Label>
                    {modelsLoading ? (
                      <div className="flex items-center gap-2 h-10 px-3 border-2 border-primary rounded-none text-[12px] font-mono text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        LOADING MODELS…
                      </div>
                    ) : models.length === 0 ? (
                      <div className="space-y-3 p-4 border-2 border-primary bg-muted/20">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-primary" />
                          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.1em]">
                            No models configured
                          </p>
                        </div>
                        <p className="text-[12px] text-muted-foreground font-body">
                          Add a provider API key (OpenAI, Google, Anthropic) or
                          connect a local LM Studio / Ollama server to use it
                          here.
                        </p>
                        <Button
                          asChild
                          variant="outline"
                          className="font-mono uppercase tracking-[0.1em] text-[11px] border-2 border-primary rounded-none"
                        >
                          <Link to="/settings/api-key">
                            <KeyRound className="w-3.5 h-3.5 mr-2" />
                            ADD API KEY
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={model}
                        onValueChange={(value) => setValue("model", value)}
                      >
                        <SelectTrigger className="border-2 border-primary rounded-none h-10">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-primary rounded-none bg-background">
                          {Object.entries(groups).map(([groupName, items]) => (
                            <SelectGroup key={groupName}>
                              <SelectLabel className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                {groupName}
                              </SelectLabel>
                              {items.map((m) => (
                                <SelectItem
                                  key={m.value}
                                  value={m.value}
                                  className="rounded-none"
                                >
                                  <div className="flex flex-col">
                                    <span className="flex items-center gap-2 font-bold font-sans">
                                      {m.label}
                                    </span>
                                    <span className="text-[11px] font-body text-muted-foreground">
                                      {m.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {errors.model && !modelsLoading && (
                      <p className="text-[11px] font-mono text-destructive uppercase">
                        {errors.model.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 p-4 border-2 border-primary bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold">
                        TEMPERATURE (0.0 - 1.0)
                      </Label>
                      <span className="font-mono text-[14px] font-bold text-primary border-b-2 border-primary w-12 text-center">
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
                    <div className="flex justify-between gap-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">
                        <span className="font-bold">0.0</span> = DETERMINISTIC
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">
                        <span className="font-bold">1.0</span> = CREATIVE
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="maxTokens"
                      className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold"
                    >
                      MAX TOKENS
                    </Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min={256}
                      max={8192}
                      {...register("maxTokens", { valueAsNumber: true })}
                      className={cn(
                        "border-2 border-primary rounded-none h-10 font-mono",
                        errors.maxTokens ? "border-destructive" : "",
                      )}
                    />
                    {errors.maxTokens && (
                      <p className="text-[11px] font-mono text-destructive uppercase">
                        {errors.maxTokens.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="systemPrompt"
                      className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold"
                    >
                      SYSTEM PROMPT
                    </Label>
                    <Textarea
                      id="systemPrompt"
                      placeholder="Define your AI agent's behavior..."
                      rows={4}
                      {...register("systemPrompt")}
                      className={cn(
                        "border-2 border-primary rounded-none font-mono text-[12px] resize-none",
                        errors.systemPrompt ? "border-destructive" : "",
                      )}
                      maxLength={4000}
                    />
                    {errors.systemPrompt && (
                      <p className="text-[11px] font-mono text-destructive uppercase">
                        {errors.systemPrompt.message}
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-4 pt-6 border-t-2 border-primary sm:space-x-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="font-mono uppercase tracking-[0.1em] text-[11px] border-2 border-primary hover:bg-foreground hover:text-background rounded-none"
                  >
                    CANCEL
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || modelsLoading || !model}
                    className="font-mono uppercase tracking-[0.1em] text-[11px] bg-primary text-background hover:bg-foreground hover:text-background border-2 border-primary rounded-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        CREATING...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2" />
                        CREATE PROJECT
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
