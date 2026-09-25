import { useCallback, useEffect, useState } from 'react';
import { BookOpenText, Flag, Mic, Volume2 } from 'lucide-react';
import { usePersistentState } from './lib/storage';
import { seedHandoff } from './lib/handoff';
import { seedScript } from './lib/script';
import type { HandoffState, PendingItem, Recording, Script } from './types';
import ScriptPage from './pages/ScriptPage';
import RehearsalPage from './pages/RehearsalPage';
import PendingPage from './pages/PendingPage';

type Tab = 'script' | 'rehearsal' | 'pending';

const navItems: { key: Tab; label: string; icon: typeof Mic }[] = [
  { key: 'script', label: '剧本资料', icon: BookOpenText },
  { key: 'rehearsal', label: '排练交接', icon: Mic },
  { key: 'pending', label: '待重排', icon: Flag },
];

export default function App() {
  // 三类资料分开整理、各自本地保存
  const [script, setScript] = usePersistentState<Script>('script', seedScript);
  const [handoff, setHandoff] = usePersistentState<HandoffState>('handoff', seedHandoff);
  const [recordings, setRecordings] = usePersistentState<Recording[]>('recordings', []);
  const [pending, setPending] = usePersistentState<PendingItem[]>('pending', []);

  const [tab, setTab] = useState<Tab>('rehearsal');
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const notify = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
  }, []);

  const appendPending = useCallback(
    (items: PendingItem[]) => setPending([...pending, ...items]),
    [pending, setPending],
  );

  const recordedCount = recordings.length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Volume2 size={19} /></div>
          <div>
            <strong>声线练习室</strong>
            <span>TROUPE REHEARSAL</span>
          </div>
        </div>
        <div className="side-label">工作台</div>
        <nav>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={tab === key ? 'side-link active' : 'side-link'}
              onClick={() => setTab(key)}
            >
              <Icon size={17} />
              {label}
              {key === 'pending' && pending.length > 0 && <b className="badge-warn">{pending.length}</b>}
              {key === 'rehearsal' && recordedCount > 0 && <b>{recordedCount}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="streak">
            <span>当前剧本</span>
            <strong style={{ fontSize: 15 }}>{script.title}</strong>
            <i>{script.lines.length} 句 · {script.characters.length} 个角色</i>
          </div>
          <div className="profile">
            <div className="avatar">{handoff.actorCharacter?.slice(0, 1) || '–'}</div>
            <div>
              <strong>{handoff.actorCharacter || '未选择角色'}</strong>
              <span>{handoff.actorName || '共用页面 · 请先选角色'}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'script' && (
          <ScriptPage
            script={script}
            setScript={setScript}
            recordings={recordings}
            setRecordings={setRecordings}
            appendPending={appendPending}
            notify={notify}
          />
        )}
        {tab === 'rehearsal' && (
          <RehearsalPage
            script={script}
            recordings={recordings}
            setRecordings={setRecordings}
            handoff={handoff}
            setHandoff={setHandoff}
            pendingCount={pending.length}
            goPending={() => setTab('pending')}
            notify={notify}
          />
        )}
        {tab === 'pending' && (
          <PendingPage
            pending={pending}
            setPending={setPending}
            recordings={recordings}
            setRecordings={setRecordings}
            script={script}
            setScript={setScript}
            handoff={handoff}
            setHandoff={setHandoff}
            notify={notify}
          />
        )}
      </main>

      {toast && <Toast key={toast.id} msg={toast.msg} onDone={() => setToast(null)} />}
    </div>
  );
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3600);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{msg}</div>;
}
