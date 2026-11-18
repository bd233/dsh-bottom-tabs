window.__ModuleLoader__.load({
  id: 'dsh-bottom-tabs',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    // 弹层要挂到 body 上，才不会被打横的底栏（overflow:hidden）裁掉
    let ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch (error) {
      ReactDOM = null;
    }
    const NS = 'session-tabs';
    // 用于确认页面里跑的是哪一版
    const VERSION = '0.2.0';
    // 键保持不变：老版本读到新数据只会忽略工作区条目，退化成纯会话 Tab，不崩不丢
    const STORE_KEY = 'dsh.session-tabs.v1';
    const STORE_BACKUP = STORE_KEY + '.bak';
    const SCHEMA = 2;
    // 工作区标签把会话 id 拼成一个字符串传给子组件，既省渲染又能让 memo 只比字符串
    const SEP = '\u0001';

    const zh = {
      newTab: '新建标签',
      closeTab: '关闭标签',
      newSession: '新会话',
      untitled: '未命名会话',
      addToTabs: '添加到标签栏',
      untitledWorkspace: '未命名工作区',
      workspaceSessions: '工作区会话',
      noSessions: '该工作区还没有会话',
      inBar: '已在底栏',
      justNow: '刚刚',
      minutes: '分钟前',
      hours: '小时前',
      days: '天前',
    };
    const en = {
      newTab: 'New tab',
      closeTab: 'Close tab',
      newSession: 'New session',
      untitled: 'Untitled session',
      addToTabs: 'Add to tab strip',
      untitledWorkspace: 'Untitled workspace',
      workspaceSessions: 'Workspace sessions',
      noSessions: 'No sessions in this workspace yet',
      inBar: 'In tab strip',
      justNow: 'just now',
      minutes: 'm ago',
      hours: 'h ago',
      days: 'd ago',
    };

    // 条高、标签宽度、脉动周期都走 CSS 变量，主题或用户样式表可以覆盖
    const CSS = [
      // 底栏：工具条底色，顶边一条细线只从左栏右边缘开始
      '.dsst-bar{--dsst-height:36px;--dsst-tab-min:56px;--dsst-tab-max:200px;--dsst-pulse:1.4s;position:relative;display:flex;align-items:stretch;gap:2px;height:var(--dsst-height);box-sizing:border-box;padding:0 6px 0 calc(var(--dsh-windows-sidebar-width,0px) + 6px);background:var(--dsw-specific-sidebar-fill);overflow:hidden}',
      '.dsst-bar::before{content:"";position:absolute;top:0;left:var(--dsh-windows-sidebar-width,0px);right:0;height:1px;background:var(--dsw-alias-border-l1);z-index:2;pointer-events:none}',
      // 标签多到放不下时不滚动，直接压缩每个标签的宽度（标题省略号），「+」紧跟最后一个标签
      // 标签：倒挂的浏览器页签，开口朝上（顶部与上方内容同色、盖住分隔线）
      '.dsst-tab{position:relative;z-index:1;display:flex;align-items:center;gap:8px;height:100%;padding:0 8px 0 12px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;cursor:pointer;white-space:nowrap;max-width:var(--dsst-tab-max);min-width:var(--dsst-tab-min);flex:0 1 auto;border-radius:0 0 10px 10px;overflow:hidden;user-select:none}',
      '.dsst-tab:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)}',
      // 拖拽排序：被拖的标签淡出，指针经过时其余标签实时让位
      '.dsst-tab--dragging{opacity:.45}',
      '.dsst-tab[draggable="true"]{-webkit-user-drag:element}',
      '.dsst-tab--active{z-index:3;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
      '.dsst-dot{position:relative;width:8px;height:8px;border-radius:50%;flex:none}',
      // 蓝 = 当前会话；绿 = 思考完成未读；灰 + 呼吸光圈 = 正在思考；灰 = 普通
      '.dsst-dot--current{background:var(--dsw-alias-state-business-primary)}',
      '.dsst-dot--unread{background:var(--dsw-alias-state-success-primary)}',
      '.dsst-dot--idle{background:var(--dsw-alias-state-idle-primary)}',
      '.dsst-dot--thinking{background:var(--dsw-alias-state-idle-primary)}',
      '.dsst-dot--thinking::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1.5px solid var(--dsw-alias-state-business-primary);animation:dsst-pulse var(--dsst-pulse) ease-out infinite}',
      '@keyframes dsst-pulse{0%{transform:scale(.55);opacity:.7}70%{transform:scale(1.45);opacity:0}100%{transform:scale(1.45);opacity:0}}',
      // 减少动态效果时退化成静态描边圆环，信息不丢
      '@media (prefers-reduced-motion: reduce){.dsst-dot--thinking::after{animation:none;transform:scale(1.2);opacity:.55}}',
      '.dsst-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}',
      '.dsst-close{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;font-size:17px;line-height:1;color:var(--dsw-alias-label-secondary);opacity:0;flex:none}',
      '.dsst-tab:hover .dsst-close,.dsst-tab--active .dsst-close{opacity:.75}',
      '.dsst-close:hover{background:var(--dsw-alias-interactive-bg-hover);opacity:1}',
      // 工作区标签：文件夹字形 + 展开箭头（C）区分身份；左侧竖条 + 顶部色带（A）只在“当前”时点亮
      '.dsst-tab--ws{padding-left:11px;color:var(--dsw-alias-label-primary)}',
      '.dsst-tab--ws.dsst-tab--active{box-shadow:inset 3px 0 0 0 var(--dsw-alias-state-business-primary), inset 0 2px 0 0 var(--dsw-alias-state-business-primary)}',
      '.dsst-ws-icon{display:flex;align-items:center;justify-content:center;width:13px;height:13px;flex:none;color:var(--dsw-alias-label-secondary)}',
      '.dsst-tab--ws.dsst-tab--active .dsst-ws-icon{color:var(--dsw-alias-state-business-primary)}',
      '.dsst-chevron{display:flex;align-items:center;justify-content:center;width:12px;height:12px;flex:none;color:var(--dsw-alias-label-secondary);opacity:.6;transition:transform .15s ease, opacity .15s ease}',
      '.dsst-tab--wsopen .dsst-chevron{transform:rotate(180deg);opacity:1}',
      // 归组：紧跟在工作区标签后面、且属于该工作区的会话标签，顶部一条同色细线
      '.dsst-tab--grouped{box-shadow:inset 0 2px 0 0 color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent)}',
      // 弹层固定在视口里，从标签上沿往上弹
      '.dsst-pop{position:fixed;z-index:2147483000;box-sizing:border-box;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);box-shadow:0 10px 28px color-mix(in srgb, #000 20%, transparent);max-height:min(52vh,340px);overflow:auto;display:flex;flex-direction:column;gap:1px}',
      '.dsst-pop-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none}',
      '.dsst-pop-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsst-pop-row--active{background:var(--dsw-alias-interactive-bg-hover);font-weight:600}',
      '.dsst-pop-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsst-pop-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:400}',
      '.dsst-pop-flag{flex:none;font-size:10px;padding:1px 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-weight:400}',
      '.dsst-pop-empty{padding:10px 8px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dsst-add{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:26px;height:26px;margin:5px 0 0 4px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:16px;line-height:1;cursor:pointer;flex:none}',
      '.dsst-add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
    ].join('');

    const EMPTY_LIST = [];
    const EMPTY_SET = new Set();

    // ---- localStorage：{ v:2, order: Entry[], titles, wsTitles, wsLast } ----
    // Entry = { k: 's' | 'w', id }；老格式的纯字符串 order 读进来也归一化成会话条目
    function readMap(value) {
      const out = {};
      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
          const item = value[key];
          if (typeof item === 'string' && item !== '') out[key] = item;
        }
      }
      return out;
    }

    function normalizeOrder(raw) {
      const out = [];
      const seen = new Set();
      if (!Array.isArray(raw)) return out;
      for (const item of raw) {
        let kind = null;
        let id = null;
        if (typeof item === 'string') {
          kind = 's';
          id = item;
        } else if (item && typeof item === 'object') {
          const k = item.k === 'w' ? 'w' : item.k === 's' ? 's' : null;
          const value = typeof item.id === 'string' ? item.id : '';
          if (k !== null && value !== '') {
            kind = k;
            id = value;
          }
        }
        if (kind === null || id === null) continue;
        const key = kind + ':' + id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ k: kind, id });
      }
      return out;
    }

    function readStore() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return {
          order: normalizeOrder(parsed && parsed.order),
          titles: readMap(parsed && parsed.titles),
          wsTitles: readMap(parsed && parsed.wsTitles),
          wsLast: readMap(parsed && parsed.wsLast),
        };
      } catch (error) {
        console.warn('[session-tabs] failed to read tab state:', error);
        return null;
      }
    }

    function writeStore(order, titles, wsTitles, wsLast) {
      try {
        window.localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ v: SCHEMA, order, titles, wsTitles, wsLast }),
        );
      } catch (error) {
        console.warn('[session-tabs] failed to save tab state:', error);
      }
    }

    // 升级后的第一次写回之前，把升级前的原值原样留一份，出问题能手工恢复
    function backupOriginal() {
      try {
        if (window.localStorage.getItem(STORE_BACKUP) !== null) return;
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw !== null) window.localStorage.setItem(STORE_BACKUP, raw);
      } catch (error) {
        // 配额或隐私模式：备份失败不影响主流程
      }
    }

    // ---- 模块级标签 store：标签栏与右键菜单项共用同一份状态 ----
    const tabs = {
      order: [],
      titles: {},
      wsTitles: {},
      wsLast: {},
      // useSyncExternalStore 要求同一状态下返回同一个对象，commit 时换引用
      cached: { order: [], titles: {}, wsTitles: {}, wsLast: {} },
      initialized: false,
      // localStorage 里是否已有记录：没有记录时首屏用当前会话播种
      existed: false,
      listeners: new Set(),
      init() {
        if (this.initialized) return;
        this.initialized = true;
        const stored = readStore();
        this.existed = stored !== null;
        if (stored) {
          this.order = stored.order;
          this.titles = stored.titles;
          this.wsTitles = stored.wsTitles;
          this.wsLast = stored.wsLast;
        }
        this.sync();
      },
      // 只保留 order 里仍然存在的条目对应的缓存，避免关掉的标签一直占着存储
      sync() {
        const titles = {};
        const wsTitles = {};
        const wsLast = {};
        for (const entry of this.order) {
          if (entry.k === 's') {
            const value = this.titles[entry.id];
            if (typeof value === 'string' && value !== '') titles[entry.id] = value;
          } else {
            const title = this.wsTitles[entry.id];
            if (typeof title === 'string' && title !== '') wsTitles[entry.id] = title;
            const last = this.wsLast[entry.id];
            if (typeof last === 'string' && last !== '') wsLast[entry.id] = last;
          }
        }
        this.titles = titles;
        this.wsTitles = wsTitles;
        this.wsLast = wsLast;
        this.cached = { order: this.order, titles, wsTitles, wsLast };
      },
      snapshot() {
        return this.cached;
      },
      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
      commit(order, patch) {
        this.order = order === undefined ? this.order : normalizeOrder(order);
        if (patch) {
          if (patch.titles) this.titles = patch.titles;
          if (patch.wsTitles) this.wsTitles = patch.wsTitles;
          if (patch.wsLast) this.wsLast = patch.wsLast;
        }
        this.sync();
        backupOriginal();
        writeStore(this.order, this.titles, this.wsTitles, this.wsLast);
        for (const listener of Array.from(this.listeners)) listener();
      },
      keyOf(entry) {
        return entry.k + ':' + entry.id;
      },
      has(kind, id) {
        if (typeof id !== 'string' || id === '') return false;
        return this.order.some((entry) => entry.k === kind && entry.id === id);
      },
      hasSession(id) {
        return this.has('s', id);
      },
      hasWorkspace(id) {
        return this.has('w', id);
      },
      add(kind, id) {
        if (typeof id !== 'string' || id === '' || this.has(kind, id)) return false;
        this.commit(this.order.concat([{ k: kind, id }]));
        return true;
      },
      addSession(id) {
        return this.add('s', id);
      },
      addWorkspace(id) {
        return this.add('w', id);
      },
      remove(kind, id) {
        if (!this.has(kind, id)) return false;
        this.commit(this.order.filter((entry) => !(entry.k === kind && entry.id === id)));
        return true;
      },
      // 工作区标签记住它上次活跃的会话，非当前状态下点一下就能切回去
      setLast(workspaceId, sessionId) {
        if (!this.hasWorkspace(workspaceId) || typeof sessionId !== 'string' || sessionId === '') return;
        if (this.wsLast[workspaceId] === sessionId) return;
        const next = Object.assign({}, this.wsLast);
        next[workspaceId] = sessionId;
        this.commit(undefined, { wsLast: next });
      },
    };
    // 供 ctx.contextMenus 的 observe 使用：菜单开着时标签变化会即时重算置灰状态
    const tabsSource = {
      subscribe: (listener) => tabs.subscribe(listener),
      getSnapshot: () => tabs.order,
    };

    const subscribeTabs = (listener) => tabs.subscribe(listener);
    const getTabsSnapshot = () => tabs.snapshot();

    function useTabsStore() {
      return React.useSyncExternalStore(subscribeTabs, getTabsSnapshot);
    }

    function useNoStore() {
      return null;
    }

    function labelOf(summary, fallback, t) {
      if (summary) {
        if (summary.blank) return t('newSession');
        const title = typeof summary.title === 'string' ? summary.title.trim() : '';
        if (title) return title;
      }
      return fallback || t('untitled');
    }

    function wsLabelOf(item, fallback, t) {
      if (item) {
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (title !== '') return title;
        const path = typeof item.path === 'string' ? item.path.replace(/[\\/]+$/, '') : '';
        if (path !== '') {
          const parts = path.split(/[\\/]/).filter(Boolean);
          if (parts.length > 0) return parts[parts.length - 1];
        }
      }
      if (typeof fallback === 'string' && fallback !== '') return fallback;
      return t('untitledWorkspace');
    }

    function timeOf(summary) {
      if (!summary) return 0;
      const value = summary.updatedAt;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    }

    function relTime(summary, t) {
      const ts = timeOf(summary);
      if (!ts) return '';
      const diff = Date.now() - ts;
      if (!Number.isFinite(diff) || diff < 0) return '';
      if (diff < 60 * 1000) return t('justNow');
      if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + t('minutes');
      if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + t('hours');
      return Math.floor(diff / 86400000) + t('days');
    }

    function FolderIcon() {
      return h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 13 13',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M1.6 3.3h3.2l1.1 1.4h5.5v5.2a1 1 0 0 1-1 1H2.6a1 1 0 0 1-1-1Z' }),
      );
    }

    function ChevronIcon() {
      return h(
        'svg',
        {
          width: 12,
          height: 12,
          viewBox: '0 0 12 12',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M3.2 6.8 5.6 4.3l2.4 2.5' }),
      );
    }

    // 单个会话标签：自己订阅自己那条会话与状态，别的会话变化不触发它重渲染
    function Tab(props) {
      const {
        id,
        dragKey,
        active,
        grouped,
        t,
        fallbackTitle,
        onSelect,
        onClose,
        dragging,
        onDragStart,
        onDragOver,
        onDragEnd,
      } = props;
      const summary = props.useSessions((state) =>
        state && state.byId ? state.byId[id] : undefined,
      );
      const status = props.useSessionStatus((state) =>
        state && typeof state.get === 'function' ? state.get(id) : undefined,
      );
      const label = labelOf(summary, fallbackTitle, t);

      // 优先级：当前会话 > 未读 > 思考中 > 普通
      let dot = 'dsst-dot--idle';
      if (active) dot = 'dsst-dot--current';
      else if (status && status.completionUnread === true) dot = 'dsst-dot--unread';
      else if (status && status.running === true) dot = 'dsst-dot--thinking';

      return h(
        'div',
        {
          className:
            'dsst-tab' +
            (active ? ' dsst-tab--active' : '') +
            (grouped ? ' dsst-tab--grouped' : '') +
            (dragging ? ' dsst-tab--dragging' : ''),
          title: label,
          draggable: true,
          onClick: () => onSelect(id),
          onAuxClick: (event) => {
            if (event.button === 1) onClose(id);
          },
          onDragStart: (event) => onDragStart(dragKey, event),
          onDragOver: (event) => onDragOver(dragKey, event),
          onDragEnd: () => onDragEnd(),
          onDrop: (event) => event.preventDefault(),
        },
        h('span', { className: 'dsst-dot ' + dot }),
        h('span', { className: 'dsst-title' }, label),
        h(
          'span',
          {
            className: 'dsst-close',
            title: t('closeTab'),
            onClick: (event) => {
              event.stopPropagation();
              onClose(id);
            },
          },
          '×',
        ),
      );
    }
    const MemoTab = React.memo(Tab);

    // 工作区标签：状态点是它下面所有会话的聚合，文案是工作区名
    function WsTab(props) {
      const {
        id,
        dragKey,
        label,
        sidKey,
        active,
        open,
        t,
        dragging,
        onSelect,
        onClose,
        onDragStart,
        onDragOver,
        onDragEnd,
      } = props;
      // 返回字符串而不是对象：值不变就不换引用，memo 才真的省渲染
      const flags = props.useSessionStatus((state) => {
        if (!state || typeof state.get !== 'function' || sidKey === '') return '';
        let out = '';
        for (const sid of sidKey.split(SEP)) {
          const status = state.get(sid);
          if (!status) continue;
          if (status.completionUnread === true) out += 'u';
          if (status.running === true) out += 'r';
        }
        return out;
      });

      let dot = 'dsst-dot--idle';
      if (active) dot = 'dsst-dot--current';
      else if (flags.indexOf('u') >= 0) dot = 'dsst-dot--unread';
      else if (flags.indexOf('r') >= 0) dot = 'dsst-dot--thinking';

      return h(
        'div',
        {
          className:
            'dsst-tab dsst-tab--ws' +
            (active ? ' dsst-tab--active' : '') +
            (open ? ' dsst-tab--wsopen' : '') +
            (dragging ? ' dsst-tab--dragging' : ''),
          title: label,
          draggable: true,
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: (event) => onSelect(id, event.currentTarget),
          onAuxClick: (event) => {
            if (event.button === 1) onClose(id);
          },
          onDragStart: (event) => onDragStart(dragKey, event),
          onDragOver: (event) => onDragOver(dragKey, event),
          onDragEnd: () => onDragEnd(),
          onDrop: (event) => event.preventDefault(),
        },
        h('span', { className: 'dsst-dot ' + dot }),
        h('span', { className: 'dsst-ws-icon' }, h(FolderIcon, null)),
        h('span', { className: 'dsst-title' }, label),
        h('span', { className: 'dsst-chevron' }, h(ChevronIcon, null)),
        h(
          'span',
          {
            className: 'dsst-close',
            title: t('closeTab'),
            onClick: (event) => {
              event.stopPropagation();
              onClose(id);
            },
          },
          '×',
        ),
      );
    }
    const MemoWsTab = React.memo(WsTab);

    // 弹层里的一行：状态图标与会话标签同源，两处永远一致
    function PopRow(props) {
      const { id, active, inBar, t, fallbackTitle, onPick } = props;
      const summary = props.useSessions((state) =>
        state && state.byId ? state.byId[id] : undefined,
      );
      const status = props.useSessionStatus((state) =>
        state && typeof state.get === 'function' ? state.get(id) : undefined,
      );
      const label = labelOf(summary, fallbackTitle, t);
      const meta = relTime(summary, t);

      let dot = 'dsst-dot--idle';
      if (active) dot = 'dsst-dot--current';
      else if (status && status.completionUnread === true) dot = 'dsst-dot--unread';
      else if (status && status.running === true) dot = 'dsst-dot--thinking';

      return h(
        'div',
        {
          className: 'dsst-pop-row' + (active ? ' dsst-pop-row--active' : ''),
          role: 'menuitem',
          title: label,
          onClick: () => onPick(id),
        },
        h('span', { className: 'dsst-dot ' + dot }),
        h('span', { className: 'dsst-pop-title' }, label),
        inBar ? h('span', { className: 'dsst-pop-flag' }, t('inBar')) : null,
        meta ? h('span', { className: 'dsst-pop-meta' }, meta) : null,
      );
    }
    const MemoPopRow = React.memo(PopRow);

    function WsPopover(props) {
      const { rect, rows, t, onPick, nodeRef, useSessions, useSessionStatus } = props;
      const width = Math.max(240, Math.min(360, Math.round(rect.width) + 128));
      const style = {
        left: Math.round(rect.left) + 'px',
        // 从标签上沿往上弹
        bottom: Math.round(window.innerHeight - rect.top + 6) + 'px',
        width: width + 'px',
      };
      const body =
        rows.length === 0
          ? h('div', { className: 'dsst-pop-empty' }, t('noSessions'))
          : rows.map((row) =>
              h(MemoPopRow, {
                key: row.id,
                id: row.id,
                active: row.active,
                inBar: row.inBar,
                fallbackTitle: row.fallbackTitle,
                t,
                onPick,
                useSessions,
                useSessionStatus,
              }),
            );
      const node = h(
        'div',
        {
          className: 'dsst-pop',
          style,
          ref: nodeRef,
          role: 'menu',
          'aria-label': t('workspaceSessions'),
        },
        body,
      );
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && document.body) {
        return ReactDOM.createPortal(node, document.body);
      }
      return node;
    }

    function Bar(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => zh[key] || key;
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : useNoStore;
      const useSessionStatus =
        typeof props.useSessionStatus === 'function' ? props.useSessionStatus : useNoStore;
      const useWorkspaces =
        typeof props.useWorkspaces === 'function' ? props.useWorkspaces : useNoStore;
      const list = useSessions((state) => state);
      const wsState = useWorkspaces((state) => state);
      const stored = useTabsStore();
      const order = stored.order;
      const titles = stored.titles;
      const wsTitles = stored.wsTitles;
      const wsLast = stored.wsLast;

      const settled = React.useRef(false);
      const wsSettled = React.useRef(false);
      const lastActive = React.useRef(undefined);
      const pendingAdd = React.useRef(false);
      const addTimer = React.useRef(0);

      const ready = Boolean(list && list.phase === 'ready' && list.byId);
      const wsReady = Boolean(wsState && wsState.phase === 'ready' && Array.isArray(wsState.items));
      const wsItems = wsReady ? wsState.items : EMPTY_LIST;

      const wsById = React.useMemo(() => {
        const map = new Map();
        for (const item of wsItems) {
          if (item && typeof item.workspaceId === 'string' && item.workspaceId !== '') {
            map.set(item.workspaceId, item);
          }
        }
        return map;
      }, [wsItems]);

      const archivedSessionIds =
        wsReady && Array.isArray(wsState.archivedSessionIds) ? wsState.archivedSessionIds : EMPTY_LIST;
      const archivedSet = React.useMemo(
        () => (archivedSessionIds.length === 0 ? EMPTY_SET : new Set(archivedSessionIds)),
        [archivedSessionIds],
      );

      const sessionsOf = React.useCallback(
        (workspaceId) => {
          const item = wsById.get(workspaceId);
          const ids = item && Array.isArray(item.sessionIds) ? item.sessionIds : EMPTY_LIST;
          // 已归档的会话不进标签、不进弹层、也不算“当前”
          if (archivedSet.size === 0 || ids.length === 0) return ids;
          const kept = ids.filter((sid) => !archivedSet.has(sid));
          return kept.length === ids.length ? ids : kept;
        },
        [wsById, archivedSet],
      );

      // 会话 → 所属工作区，用来在切换会话时记下“该工作区上次活跃会话”
      const ownerBySession = React.useMemo(() => {
        const map = new Map();
        for (const [workspaceId, item] of wsById) {
          const ids = Array.isArray(item.sessionIds) ? item.sessionIds : EMPTY_LIST;
          for (const sid of ids) if (!map.has(sid)) map.set(sid, workspaceId);
        }
        return map;
      }, [wsById]);

      // 正在显示的会话：mainView 保留计数 > 0 的那个（与侧栏判定同源）
      const current = React.useMemo(() => {
        if (!ready) return undefined;
        const hit = Object.values(list.byId).find(
          (summary) =>
            (summary.retainedBy && summary.retainedBy.mainView ? summary.retainedBy.mainView : 0) > 0,
        );
        return hit ? hit.id : undefined;
      }, [ready, list]);

      React.useEffect(() => {
        if (current !== undefined) lastActive.current = current;
      }, [current]);

      // 切到全局面板时 current 会短暂为 undefined，用最后一次的值保持高亮
      const active = current !== undefined ? current : lastActive.current;

      // 首次拿到会话列表：清掉已不存在的会话标签（工作区标签留给下面那支）；首次运行则播种
      React.useEffect(() => {
        if (!ready || settled.current) return;
        settled.current = true;
        tabs.commit(tabs.order.filter((entry) => entry.k === 'w' || list.byId[entry.id] !== undefined));
        if (!tabs.existed) {
          tabs.existed = true;
          if (current !== undefined) tabs.addSession(current);
        }
      }, [ready, list, current]);

      // 工作区列表到货后清掉已不存在的工作区标签
      React.useEffect(() => {
        if (!wsReady || wsSettled.current) return;
        wsSettled.current = true;
        tabs.commit(tabs.order.filter((entry) => entry.k === 's' || wsById.has(entry.id)));
      }, [wsReady, wsById]);

      // 会话标题变化（重命名、首条消息生成标题）时回写缓存
      React.useEffect(() => {
        if (!ready) return;
        let next = null;
        for (const entry of order) {
          if (entry.k !== 's') continue;
          const summary = list.byId[entry.id];
          const title = summary && typeof summary.title === 'string' ? summary.title.trim() : '';
          if (title && tabs.titles[entry.id] !== title) {
            if (next === null) next = Object.assign({}, tabs.titles);
            next[entry.id] = title;
          }
        }
        if (next !== null) tabs.commit(tabs.order, { titles: next });
      }, [ready, list, order]);

      // 工作区改名后回写缓存，工作区临时不可解析时还能显示旧名字
      React.useEffect(() => {
        if (!wsReady) return;
        let next = null;
        for (const entry of order) {
          if (entry.k !== 'w') continue;
          const item = wsById.get(entry.id);
          const title = item && typeof item.title === 'string' ? item.title.trim() : '';
          if (title !== '' && tabs.wsTitles[entry.id] !== title) {
            if (next === null) next = Object.assign({}, tabs.wsTitles);
            next[entry.id] = title;
          }
        }
        if (next !== null) tabs.commit(undefined, { wsTitles: next });
      }, [wsReady, wsById, order]);

      // 点了「+」之后，等新会话成为当前会话，再把它作为一个标签加进来
      React.useEffect(() => {
        if (active === undefined || !pendingAdd.current) return;
        pendingAdd.current = false;
        tabs.addSession(active);
      }, [active]);

      React.useEffect(
        () => () => {
          if (addTimer.current) window.clearTimeout(addTimer.current);
        },
        [],
      );

      const activeRef = React.useRef(active);
      activeRef.current = active;
      const orderRef = React.useRef(order);
      orderRef.current = order;

      // 拖拽排序：dragKey 是正在拖的标签，draggingKey 只是用来给当前拖的标签加样式
      const dragId = React.useRef(null);
      const draggingRef = React.useRef(false);
      const [draggingId, setDraggingId] = React.useState(null);

      const select = React.useCallback(
        (id) => {
          // 拖拽结束时浏览器可能补一次 click，别顺手把会话切走
          if (draggingRef.current) return;
          lastActive.current = id;
          if (typeof props.openSession === 'function') props.openSession(id);
          const owner = ownerBySession.get(id);
          if (owner !== undefined) tabs.setLast(owner, id);
        },
        [props.openSession, ownerBySession],
      );

      const closeTab = React.useCallback(
        (id) => {
          const previous = orderRef.current;
          const key = 's:' + id;
          const index = previous.findIndex((entry) => entry.k + ':' + entry.id === key);
          tabs.remove('s', id);
          // 关掉的是当前标签就切到相邻的一个；只是移出标签栏，不归档会话
          if (id === activeRef.current) {
            const rest = previous.filter((entry) => entry.k + ':' + entry.id !== key);
            const neighbour = rest[Math.max(0, index - 1)] || rest[0];
            if (neighbour && neighbour.k === 's') select(neighbour.id);
          }
        },
        [select],
      );

      const closeWsTab = React.useCallback((workspaceId) => {
        setPop((prev) => (prev && prev.wsId === workspaceId ? null : prev));
        tabs.remove('w', workspaceId);
      }, []);

      const addTab = React.useCallback(() => {
        if (pendingAdd.current) return;
        pendingAdd.current = true;
        if (typeof props.newSession === 'function') props.newSession();
        if (addTimer.current) window.clearTimeout(addTimer.current);
        addTimer.current = window.setTimeout(() => {
          pendingAdd.current = false;
          addTimer.current = 0;
        }, 1500);
      }, [props.newSession]);

      // 把 fromKey 移到「插入位置 insert」（insert 按移动前的下标计）
      const moveTo = React.useCallback((fromKey, insert) => {
        const prev = orderRef.current;
        const fromIndex = prev.findIndex((entry) => entry.k + ':' + entry.id === fromKey);
        if (fromIndex < 0) return;
        let to = insert;
        if (to > fromIndex) to -= 1;
        if (to === fromIndex) return;
        const next = prev.slice();
        const moved = next.splice(fromIndex, 1)[0];
        next.splice(to, 0, moved);
        orderRef.current = next;
        tabs.commit(next);
      }, []);

      const dragStart = React.useCallback((key, event) => {
        const target = event.target;
        // 从关闭按钮上按下不进入拖拽
        if (target && typeof target.closest === 'function' && target.closest('.dsst-close')) {
          event.preventDefault();
          return;
        }
        dragId.current = key;
        draggingRef.current = true;
        setDraggingId(key);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          try {
            event.dataTransfer.setData('text/plain', key);
          } catch (error) {
            // 少数情况下 dataTransfer 只读，忽略即可
          }
        }
      }, []);

      const dragOver = React.useCallback(
        (key, event) => {
          const from = dragId.current;
          if (from === null || from === key) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          const targetIndex = orderRef.current.findIndex(
            (entry) => entry.k + ':' + entry.id === key,
          );
          if (targetIndex < 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const after = event.clientX > rect.left + rect.width / 2;
          moveTo(from, after ? targetIndex + 1 : targetIndex);
        },
        [moveTo],
      );

      const dragEnd = React.useCallback(() => {
        dragId.current = null;
        draggingRef.current = false;
        setDraggingId(null);
      }, []);

      // 拖到标签条空白处 = 移到末尾
      const dragOverBar = React.useCallback(
        (event) => {
          const from = dragId.current;
          if (from === null || event.target !== event.currentTarget) return;
          event.preventDefault();
          moveTo(from, orderRef.current.length);
        },
        [moveTo],
      );

      // 工作区标签后面紧跟的、属于它的会话标签，用同一色的顶线归到一起
      const groupOf = React.useMemo(() => {
        const map = new Map();
        let lastWs = null;
        order.forEach((entry, index) => {
          if (entry.k === 'w') {
            lastWs = entry.id;
            return;
          }
          if (lastWs === null) return;
          const ids = sessionsOf(lastWs);
          if (ids.indexOf(entry.id) >= 0) map.set(index, lastWs);
        });
        return map;
      }, [order, sessionsOf]);

      // 工作区弹层：{ wsId, rect, el }
      const [pop, setPop] = React.useState(null);
      const popRef = React.useRef(null);

      const popPick = React.useCallback(
        (sessionId) => {
          setPop(null);
          select(sessionId);
        },
        [select],
      );

      const wsSelect = React.useCallback(
        (workspaceId, element) => {
          if (draggingRef.current) return;
          const ids = sessionsOf(workspaceId);
          const isCurrent = ids.some((sid) => sid === activeRef.current);
          // 当前状态：向上弹出该工作区的会话列表
          if (isCurrent) {
            const rect =
              element && typeof element.getBoundingClientRect === 'function'
                ? element.getBoundingClientRect()
                : null;
            setPop((prev) => {
              if (prev && prev.wsId === workspaceId) return null;
              return rect ? { wsId: workspaceId, rect, el: element } : prev;
            });
            return;
          }
          // 非当前状态：切到该工作区上次活跃的会话
          const alive = ready ? ids.filter((sid) => list.byId[sid] !== undefined) : EMPTY_LIST;
          const remembered = wsLast[workspaceId];
          let pick;
          if (remembered !== undefined && alive.indexOf(remembered) >= 0) pick = remembered;
          if (pick === undefined && alive.length > 0) {
            const sorted = alive
              .slice()
              .sort((a, b) => timeOf(list.byId[b]) - timeOf(list.byId[a]));
            pick = sorted[0];
          }
          if (pick !== undefined) {
            setPop(null);
            select(pick);
            return;
          }
          // 工作区里一个会话都没有：走 connectWorkspace 进去
          setPop(null);
          if (typeof props.openWorkspace === 'function') props.openWorkspace(workspaceId);
        },
        [sessionsOf, wsLast, ready, list, select, props.openWorkspace],
      );

      // 点外部 / Esc / 滚动 / 尺寸变化都收起弹层；点在来源标签上时交给 click 自己 toggle
      React.useEffect(() => {
        if (!pop) return undefined;
        const onDown = (event) => {
          const node = popRef.current;
          if (node && node.contains(event.target)) return;
          if (pop.el && pop.el.contains(event.target)) return;
          setPop(null);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setPop(null);
          }
        };
        const onScroll = (event) => {
          const node = popRef.current;
          if (node && event && node.contains(event.target)) return;
          setPop(null);
        };
        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onScroll);
        window.addEventListener('scroll', onScroll, true);
        return () => {
          document.removeEventListener('mousedown', onDown, true);
          document.removeEventListener('keydown', onKey, true);
          window.removeEventListener('resize', onScroll);
          window.removeEventListener('scroll', onScroll, true);
        };
      }, [pop]);

      // 工作区标签被关掉或工作区消失时，弹层跟着消失
      React.useEffect(() => {
        if (!pop) return;
        if (!tabs.hasWorkspace(pop.wsId)) {
          setPop(null);
          return;
        }
        if (wsReady && !wsById.has(pop.wsId)) setPop(null);
      }, [pop, wsReady, wsById]);

      const popRows = React.useMemo(() => {
        if (!pop) return EMPTY_LIST;
        const ids = sessionsOf(pop.wsId);
        const rows = [];
        for (const sid of ids) {
          if (!ready || !list.byId[sid]) continue;
          rows.push({
            id: sid,
            active: active === sid,
            inBar: tabs.hasSession(sid),
            fallbackTitle: titles[sid],
          });
        }
        return rows;
        // stored 进依赖：标题与「已在底栏」都跟着 store 变
      }, [pop, sessionsOf, ready, list, active, titles, stored]);

      return h(
        React.Fragment,
        null,
        h('style', { key: 'css' }, CSS),
        h(
          'div',
          { key: 'bar', className: 'dsst-bar', onDragOver: dragOverBar },
          order.map((entry, index) => {
            const dragKey = entry.k + ':' + entry.id;
            if (entry.k === 'w') {
              const item = wsById.get(entry.id);
              // 已归档会话既不进弹层，也不参与状态点/“当前”判定
              const ids = sessionsOf(entry.id);
              return h(MemoWsTab, {
                key: dragKey,
                id: entry.id,
                dragKey,
                label: wsLabelOf(item, wsTitles[entry.id], t),
                sidKey: ids.join(SEP),
                active: ids.some((sid) => sid === active),
                open: Boolean(pop && pop.wsId === entry.id),
                t,
                dragging: draggingId === dragKey,
                onSelect: wsSelect,
                onClose: closeWsTab,
                onDragStart: dragStart,
                onDragOver: dragOver,
                onDragEnd: dragEnd,
                useSessionStatus,
              });
            }
            return h(MemoTab, {
              key: dragKey,
              id: entry.id,
              dragKey,
              t,
              active: active === entry.id,
              grouped: groupOf.has(index),
              dragging: draggingId === dragKey,
              fallbackTitle: titles[entry.id],
              onSelect: select,
              onClose: closeTab,
              onDragStart: dragStart,
              onDragOver: dragOver,
              onDragEnd: dragEnd,
              useSessions,
              useSessionStatus,
            });
          }),
          h(
            'button',
            {
              key: 'add',
              type: 'button',
              className: 'dsst-add',
              title: t('newTab'),
              'aria-label': t('newTab'),
              onClick: addTab,
            },
            '+',
          ),
        ),
        pop
          ? h(WsPopover, {
              key: 'pop',
              rect: pop.rect,
              rows: popRows,
              t,
              onPick: popPick,
              nodeRef: popRef,
              useSessions,
              useSessionStatus,
            })
          : null,
      );
    }

    // 右键菜单「添加到标签栏」的图标：一个标签页轮廓 + 内部加号
    function TabIcon() {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M3.5 4.5h9A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V6a1.5 1.5 0 0 1 1.5-1.5Z' }),
        h('path', { d: 'M8 7.25v3.5M6.25 9h3.5' }),
      );
    }

    // 工作区那一项：文件夹轮廓 + 加号
    function WsIcon() {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M2 4.2A1.2 1.2 0 0 1 3.2 3h3.1l1.2 1.4h5.3A1.2 1.2 0 0 1 14 5.6v6.2A1.2 1.2 0 0 1 12.8 13H3.2A1.2 1.2 0 0 1 2 11.8Z' }),
        h('path', { d: 'M8 7.6v3.2M6.4 9.2h3.2' }),
      );
    }

    // 菜单是加分项：contextMenus 缺失时整条标签栏仍然工作
    // 任何一处渲染出错都只让标签栏自己消失，不要把宿主的 slot 一起带崩
    class BarBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        console.error('[session-tabs] bar crashed:', error);
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    function BarSlot(props) {
      return h(BarBoundary, null, h(Bar, props));
    }

    function registerMenus(ctx) {
      if (!ctx.contextMenus || typeof ctx.contextMenus.register !== 'function') return;
      const t = ctx.locale.bind(NS);
      const guard = (label, run) => {
        try {
          run();
        } catch (error) {
          console.error('[session-tabs] failed to register ' + label + ':', error);
        }
      };
      guard('session menu entry', () =>
        ctx.effect(
          () =>
            ctx.contextMenus.register({
              id: 'session.sessionTabs',
              target: 'session',
              // 排在“复制会话 ID”(450) 之后、“归档”(600) 之前
              order: 500,
              observe: () => [tabsSource, ctx.locale],
              resolve: (target) => {
                const present = tabs.hasSession(target.sessionId);
                return [
                  {
                    id: 'addToTab',
                    label: t('addToTabs'),
                    icon: { key: 'session-tabs.add' },
                    disabled: present,
                    run: () => {
                      tabs.addSession(target.sessionId);
                    },
                  },
                ];
              },
            }),
          'session-tabs: session menu entry',
        ),
      );

      guard('workspace menu entry', () =>
        ctx.effect(
          () =>
            ctx.contextMenus.register({
              id: 'workspace.sessionTabs',
              target: 'workspace',
              // 官方顺序：重命名 100 → 在文件夹显示 200 → 删除工作区 300（带分隔线）
              // 放在 250，紧跟“在文件夹显示”，且落在删除工作区分隔线之上
              order: 250,
              observe: () => [tabsSource, ctx.locale],
              resolve: (target) => {
                const workspaceId = target && typeof target.workspaceId === 'string' ? target.workspaceId : '';
                if (workspaceId === '') return [];
                const present = tabs.hasWorkspace(workspaceId);
                return [
                  {
                    id: 'addToTab',
                    label: t('addToTabs'),
                    icon: { key: 'session-tabs.addWorkspace' },
                    disabled: present,
                    run: () => {
                      tabs.addWorkspace(workspaceId);
                    },
                  },
                ];
              },
            }),
          'session-tabs: workspace menu entry',
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        tabs.init();

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-tabs: dictionaries');
        const t = ctx.locale.bind(NS);

        // 会话切换与新建都走 uiWorkspace，与侧栏按钮的行为保持一致
        const openSession = (id) => {
          const ui = ctx.get('uiWorkspace');
          if (!ui || typeof ui.openSession !== 'function') {
            console.warn('[session-tabs] uiWorkspace is unavailable, cannot switch session');
            return;
          }
          ui.openSession(id);
        };

        const newSession = () => {
          const ui = ctx.get('uiWorkspace');
          if (!ui || typeof ui.startSession !== 'function') {
            console.warn('[session-tabs] uiWorkspace is unavailable, cannot start a session');
            return;
          }
          ui.startSession();
        };

        // 进入一个没有任何会话的工作区：等宿主把会话建好再切过去
        const openWorkspace = (workspaceId) => {
          const ui = ctx.get('uiWorkspace');
          if (ui && typeof ui.connectWorkspace === 'function') {
            Promise.resolve(ui.connectWorkspace(workspaceId)).then(
              (sessionId) => {
                if (typeof sessionId === 'string' && sessionId !== '') openSession(sessionId);
              },
              (error) => {
                console.warn('[session-tabs] failed to open workspace:', error);
              },
            );
            return;
          }
          const sessions = ctx.get('sessions');
          if (sessions && typeof sessions.create === 'function') {
            Promise.resolve(sessions.create({ workspaceId })).then(
              (summary) => {
                const id = summary && (summary.id || summary.sessionId);
                if (typeof id === 'string' && id !== '') {
                  tabs.addSession(id);
                  openSession(id);
                }
              },
              (error) => {
                console.warn('[session-tabs] failed to create session in workspace:', error);
              },
            );
          }
        };

        ctx.slots.inject('shell.bottom', () =>
          ctx.slots.register(
            {
              name: 'shell.bottom',
              id: 'session-tabs.bar',
              locale: NS,
              inject: () => ({ t, openSession, newSession, openWorkspace }),
            },
            BarSlot,
          ),
        );

        // 侧栏右键菜单：会话与工作区两种目标各一个图标（任何一个失败都不影响标签栏）
        const safeInject = (label, run) => {
          try {
            run();
          } catch (error) {
            console.error('[session-tabs] failed to register ' + label + ':', error);
          }
        };
        safeInject('session menu icon', () =>
          ctx.slots.inject('contextMenu.icon', () =>
            ctx.slots.register({ name: 'contextMenu.icon', key: 'session-tabs.add' }, TabIcon),
          ),
        );
        safeInject('workspace menu icon', () =>
          ctx.slots.inject('contextMenu.icon', () =>
            ctx.slots.register({ name: 'contextMenu.icon', key: 'session-tabs.addWorkspace' }, WsIcon),
          ),
        );

        safeInject('menus', () => {
          if (ctx.get('contextMenus')) registerMenus(ctx);
          else if (typeof ctx.inject === 'function') {
            ctx.inject(['contextMenus'], (child) => registerMenus(child));
          }
        });

        console.info('[session-tabs] v' + VERSION + ' ready');
      },
    };
  },
});
