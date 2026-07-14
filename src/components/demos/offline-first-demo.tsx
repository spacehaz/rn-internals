import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";

type Todo = { id: string; title: string; completed: number };
type QueuedMutation = { id: number; todoId: string; operation: string; payload: string; createdAt: number };

async function initializeOfflineFirstDb(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todoId TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
}

function OfflineFirstDemoInner() {
  const db = useSQLiteContext();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Local-first reads: both the actual data AND the queue state are read
  // straight from SQLite, never from any network call.
  const refresh = useCallback(async () => {
    setTodos(await db.getAllAsync<Todo>("SELECT * FROM todos ORDER BY rowid DESC"));
    setQueue(await db.getAllAsync<QueuedMutation>("SELECT * FROM mutation_queue ORDER BY createdAt ASC"));
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTodo = useCallback(async () => {
    const id = Date.now().toString();
    const title = `Task ${id.slice(-4)}`;
    // Optimistic write — committed to local storage (and thus visible in the
    // UI on next refresh) immediately, before any "server" has seen it.
    await db.runAsync("INSERT INTO todos (id, title, completed) VALUES (?, ?, 0)", id, title);
    // Record the operation itself (not just the resulting state) so it can be
    // replayed against a server later — the actual mutation queue.
    await db.runAsync(
      "INSERT INTO mutation_queue (todoId, operation, payload, createdAt) VALUES (?, ?, ?, ?)",
      id, "create", JSON.stringify({ title }), Date.now(),
    );
    await refresh();
  }, [db, refresh]);

  const toggleTodo = useCallback(async (todo: Todo) => {
    const newCompleted = todo.completed ? 0 : 1;
    await db.runAsync("UPDATE todos SET completed = ? WHERE id = ?", newCompleted, todo.id);
    await db.runAsync(
      "INSERT INTO mutation_queue (todoId, operation, payload, createdAt) VALUES (?, ?, ?, ?)",
      todo.id, "update", JSON.stringify({ completed: newCompleted }), Date.now(),
    );
    await refresh();
  }, [db, refresh]);

  const syncQueue = useCallback(async () => {
    setSyncing(true);
    setSyncLog([]);
    const pending = await db.getAllAsync<QueuedMutation>(
      "SELECT * FROM mutation_queue ORDER BY createdAt ASC",
    );
    for (const mutation of pending) {
      // Simulate a server round trip — this is standing in for a real fetch()
      // to a backend that would apply the mutation and confirm or reject it.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const serverAccepted = Math.random() > 0.3;

      if (serverAccepted) {
        await db.runAsync("DELETE FROM mutation_queue WHERE id = ?", mutation.id);
        setSyncLog((log) => [...log, `✓ synced ${mutation.operation} ${mutation.todoId}`]);
      } else {
        // Rollback: the server rejected this mutation, so the optimistic
        // local change was wrong and needs to be undone. Only 'create' is
        // rolled back here (delete the row that should never have existed
        // locally) — 'update' rollback would need the prior value captured
        // in the queue entry to revert to, which this minimal demo omits.
        if (mutation.operation === "create") {
          await db.runAsync("DELETE FROM todos WHERE id = ?", mutation.todoId);
        }
        await db.runAsync("DELETE FROM mutation_queue WHERE id = ?", mutation.id);
        setSyncLog((log) => [...log, `✗ rejected ${mutation.operation} ${mutation.todoId} — rolled back`]);
      }
    }
    setSyncing(false);
    await refresh();
  }, [db, refresh]);

  return (
    <View style={{ padding: 16, gap: 8, flex: 1 }}>
      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#0ea5e9", borderRadius: 8 }}
        onPress={addTodo}
      >
        <Text style={{ color: "white", textAlign: "center" }}>Add todo (optimistic)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ padding: 10, backgroundColor: "#22c55e", borderRadius: 8 }}
        onPress={syncQueue}
        disabled={syncing}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          {syncing ? "Syncing..." : `Sync queue (${queue.length} pending)`}
        </Text>
      </TouchableOpacity>

      <Text style={{ fontWeight: "bold", marginTop: 8 }}>Todos (local-first):</Text>
      {todos.map((todo) => (
        <TouchableOpacity key={todo.id} onPress={() => toggleTodo(todo)}>
          <Text>
            {todo.completed ? "✅" : "⬜️"} {todo.title}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={{ fontWeight: "bold", marginTop: 8 }}>Pending mutations:</Text>
      {queue.map((m) => (
        <Text key={m.id} style={{ color: "#6b7280" }}>
          {m.operation} {m.todoId}
        </Text>
      ))}

      <Text style={{ fontWeight: "bold", marginTop: 8 }}>Sync log:</Text>
      {syncLog.map((line, i) => (
        <Text key={i} style={{ color: "#6b7280" }}>{line}</Text>
      ))}
    </View>
  );
}

export default function OfflineFirstDemo() {
  return (
    <SQLiteProvider databaseName="offline-first-demo.db" onInit={initializeOfflineFirstDb}>
      <OfflineFirstDemoInner />
    </SQLiteProvider>
  );
}
