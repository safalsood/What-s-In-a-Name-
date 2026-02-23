import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {
  HelmetProvider,
} from "react-helmet-async"



const container = document.getElementById("root") as HTMLDivElement;
createRoot(container).render(<HelmetProvider><App /></HelmetProvider>);
    