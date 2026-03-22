import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Ocorreu um erro inesperado. Tente recarregar o componente.
              </p>
            </div>
            <Button onClick={this.handleReset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
