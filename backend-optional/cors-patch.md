# Optional: CORS for the existing backend

The app uses Capacitor's native HTTP layer (`CapacitorHttp.enabled = true`), so **no backend change is required**.
If you ever disable that plugin (or run the app in a plain browser against a remote API), add this to `server/index.ts`
of the existing backend, before `registerRoutes`:

```ts
import cors from "cors"; // npm i cors
app.use(cors({ origin: ["https://localhost", "capacitor://localhost", "http://localhost"] }));
```
