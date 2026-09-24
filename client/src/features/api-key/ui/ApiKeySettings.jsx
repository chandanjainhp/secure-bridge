import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Shield,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useApiKeyStore } from "../hooks/useApiKeyStore";
import { clearAvailableModelsCache } from "@/features/chat/api/availableModels";

const defaultLocalConnection = {
  name: "Local LLM",
  baseUrl: "http://127.0.0.1:1234/v1",
  model: "google/gemma-4-e4b",
  enabled: true,
};

export default function ApiKeySettings() {
  const [provider, setProvider] = useState("openai");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localConnection, setLocalConnection] = useState(
    defaultLocalConnection,
  );
  const {
    hasKey,
    maskedKey,
    localConnection: savedLocalConnection,
    isLoading,
    error,
    fetchApiKey,
    saveApiKey,
    deleteApiKey,
    clearError,
  } = useApiKeyStore();

  useEffect(() => {
    fetchApiKey().catch(() => {});
  }, [fetchApiKey]);

  useEffect(() => {
    if (!savedLocalConnection) return;
    setProvider("local");
    setLocalConnection((current) => ({ ...current, ...savedLocalConnection }));
  }, [savedLocalConnection]);

  const updateLocalConnection = (field, value) => {
    setLocalConnection((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (provider !== "local" && !key.trim()) return;
    setIsSubmitting(true);
    clearError();
    try {
      await saveApiKey(
        provider,
        key.trim(),
        provider === "local" ? localConnection : undefined,
      );
      setKey("");
      clearAvailableModelsCache();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    clearError();
    try {
      await deleteApiKey(
        provider === "local" ? savedLocalConnection?.id : undefined,
      );
      clearAvailableModelsCache();
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isLoading;
  const canSaveLocal =
    localConnection.baseUrl.trim() && localConnection.model.trim();
  const maskKey = maskedKey || (hasKey ? "••••••••••••••••" : "");

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Management
        </CardTitle>
        <CardDescription>
          Connect cloud providers or a local OpenAI-compatible server such as LM
          Studio or Ollama.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {provider !== "local" && hasKey && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">API key configured</p>
                <p className="text-xs text-muted-foreground">
                  Provider: {provider} • Key: {maskKey}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}

        {provider === "local" && savedLocalConnection && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Local LLM configured</p>
                <p className="text-xs text-muted-foreground">
                  {savedLocalConnection.baseUrl} • {savedLocalConnection.model}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}

        {(!hasKey || provider === "local") && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="local">Local LLM (LM Studio / Ollama)</option>
              </select>
            </div>

            {provider === "local" ? (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="localName">Connection name</Label>
                  <Input
                    id="localName"
                    value={localConnection.name}
                    onChange={(event) =>
                      updateLocalConnection("name", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="baseUrl">OpenAI-compatible base URL</Label>
                  <Input
                    id="baseUrl"
                    value={localConnection.baseUrl}
                    onChange={(event) =>
                      updateLocalConnection("baseUrl", event.target.value)
                    }
                    placeholder="http://127.0.0.1:1234/v1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    LM Studio commonly uses port 1234. Ollama commonly uses port
                    11434.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="localModel">Model identifier</Label>
                  <Input
                    id="localModel"
                    value={localConnection.model}
                    onChange={(event) =>
                      updateLocalConnection("model", event.target.value)
                    }
                    placeholder="Model id served by your local runtime"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="localToken">Optional API token</Label>
                  <div className="relative">
                    <Input
                      id="localToken"
                      type={showKey ? "text" : "password"}
                      value={key}
                      onChange={(event) => setKey(event.target.value)}
                      placeholder="Leave blank if not required"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowKey((current) => !current)}
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="sk-..."
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowKey((current) => !current)}
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                busy || (provider === "local" ? !canSaveLocal : !key.trim())
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Connection
            </Button>
          </form>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Cloud and local tokens are encrypted at rest. Raw tokens are never
            returned to the client.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
