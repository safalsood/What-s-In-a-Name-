import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeModeProvider } from "../helpers/themeMode";
import { AuthProvider } from "../helpers/useAuth";
import { TooltipProvider } from "./Tooltip";
import { SonnerToaster } from "./SonnerToaster";
import { ScrollToHashElement } from "./ScrollToHashElement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute “fresh” window
    },
  },
});

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeModeProvider>
          <ScrollToHashElement />
          <TooltipProvider>
            {children}
            <SonnerToaster />
          </TooltipProvider>
        </ThemeModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
