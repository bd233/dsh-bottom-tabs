window.__ModuleLoader__.load({
  id: 'dsh-bottom-tabs',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'session-tabs';
    const STORE_KEY = 'dsh.session-tabs.v1';

    const zh = {
      newTab: '新建标签',
      closeTab: '关闭标签',
      newSession: '新会话',
      untitled: '未命名会话',
      addToTab: '添加到 Tab',
    };
    const en = {
      newTab: 'New tab',
      closeTab: 'Close tab',
      newSession: 'New session',
      untitled: 'Untitled session',
      addToTab: 'Add to tab',
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
      '.dsst-add{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:26px;height:26px;margin:5px 0 0 4px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:16px;line-height:1;cursor:pointer;flex:none}',
      '.dsst-add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
    ].join('');

    // ---- localStorage：{ order: SessionId[], titles: { [id]: title } } ----
    function readStore() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        const order = Array.isArray(parsed && parsed.order)
          ? parsed.order.filter((id) => typeof id === 'string' && id !== '')
          : [];
        const titles = {};
        const stored = parsed && parsed.titles;
        if (stored && typeof stored === 'object') {
          for (const id of Object.keys(stored)) {
            const value = stored[id];
            if (typeof value === 'string' && value !== '') titles[id] = value;
          }
        }
        return { order, titles };
      } catch (error) {
        console.warn('[session-tabs] failed to read tab state:', error);
        return null;
      }
    }

    function writeStore(order, titles) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify({ order, titles }));
      } catch (error) {
        console.warn('[session-tabs] failed to save tab state:', error);
      }
    }

    // ---- 模块级标签 store：标签栏与右键菜单项共用同一份状态 ----
    const tabs = {
      order: [],
      titles: {},
      // useSyncExternalStore 要求同一状态下返回同一个对象，commit 时换引用
      cached: { order: [], titles: {} },
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
        }
        this.cached = { order: this.order, titles: this.titles };
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
      // titles 只保留 order 里仍然存在的会话，避免关掉的标签一直占着存储
      commit(order, titles) {
        const nextOrder = order === undefined ? this.order : order;
        const source = titles === undefined ? this.titles : titles;
        const nextTitles = {};
        for (const id of nextOrder) {
          const value = source[id];
          if (typeof value === 'string' && value !== '') nextTitles[id] = value;
        }
        this.order = nextOrder;
        this.titles = nextTitles;
        this.cached = { order: nextOrder, titles: nextTitles };
        writeStore(nextOrder, nextTitles);
        for (const listener of Array.from(this.listeners)) listener();
      },
      has(id) {
        return this.order.indexOf(id) >= 0;
      },
      add(id) {
        if (typeof id !== 'string' || id === '' || this.has(id)) return false;
        this.commit(this.order.concat([id]));
        return true;
      },
      remove(id) {
        if (!this.has(id)) return false;
        this.commit(this.order.filter((item) => item !== id));
        return true;
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

    // 单个标签：自己订阅自己那条会话与状态，别的会话变化不触发它重渲染
    function Tab(props) {
      const {
        id,
        active,
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
            'dsst-tab' + (active ? ' dsst-tab--active' : '') + (dragging ? ' dsst-tab--dragging' : ''),
          title: label,
          draggable: true,
          onClick: () => onSelect(id),
          onAuxClick: (event) => {
            if (event.button === 1) onClose(id);
          },
          onDragStart: (event) => onDragStart(id, event),
          onDragOver: (event) => onDragOver(id, event),
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

    function Bar(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => zh[key] || key;
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : useNoStore;
      const useSessionStatus =
        typeof props.useSessionStatus === 'function' ? props.useSessionStatus : useNoStore;
      const list = useSessions((state) => state);
      const stored = useTabsStore();
      const order = stored.order;
      const titles = stored.titles;

      const settled = React.useRef(false);
      const lastActive = React.useRef(undefined);
      const pendingAdd = React.useRef(false);
      const addTimer = React.useRef(0);

      const ready = Boolean(list && list.phase === 'ready' && list.byId);

      // 正在显示的会话：mainView 保留计数 > 0 的那个（与侧栏判定同源）
      const current = React.useMemo(() => {
        if (!ready) return undefined;
        const hit = Object.values(list.byId).find(
          (summary) => (summary.retainedBy && summary.retainedBy.mainView ? summary.retainedBy.mainView : 0) > 0,
        );
        return hit ? hit.id : undefined;
      }, [ready, list]);

      React.useEffect(() => {
        if (current !== undefined) lastActive.current = current;
      }, [current]);

      // 切到全局面板时 current 会短暂为 undefined，用最后一次的值保持高亮
      const active = current !== undefined ? current : lastActive.current;

      // 首次拿到会话列表：清掉已不存在的标签；首次运行则用当前会话播种
      React.useEffect(() => {
        if (!ready || settled.current) return;
        settled.current = true;
        tabs.commit(tabs.order.filter((id) => list.byId[id] !== undefined));
        if (!tabs.existed) {
          tabs.existed = true;
          if (current !== undefined) tabs.add(current);
        }
      }, [ready, list, current]);

      // 会话标题变化（重命名、首条消息生成标题）时回写缓存
      React.useEffect(() => {
        if (!ready) return;
        let next = null;
        for (const id of order) {
          const summary = list.byId[id];
          const title = summary && typeof summary.title === 'string' ? summary.title.trim() : '';
          if (title && tabs.titles[id] !== title) {
            if (next === null) next = Object.assign({}, tabs.titles);
            next[id] = title;
          }
        }
        if (next !== null) tabs.commit(tabs.order, next);
      }, [ready, list, order]);

      // 点了「+」之后，等新会话成为当前会话，再把它作为一个标签加进来
      React.useEffect(() => {
        if (active === undefined || !pendingAdd.current) return;
        pendingAdd.current = false;
        tabs.add(active);
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

      // 拖拽排序：dragId 是正在拖的标签，draggingId 只是用来给当前拖的标签加样式
      const dragId = React.useRef(null);
      const draggingRef = React.useRef(false);
      const [draggingId, setDraggingId] = React.useState(null);

      const select = React.useCallback(
        (id) => {
          // 拖拽结束时浏览器可能补一次 click，别顺手把会话切走
          if (draggingRef.current) return;
          lastActive.current = id;
          if (typeof props.openSession === 'function') props.openSession(id);
        },
        [props.openSession],
      );

      const closeTab = React.useCallback(
        (id) => {
          const previous = orderRef.current;
          const index = previous.indexOf(id);
          tabs.remove(id);
          // 关掉的是当前标签就切到相邻的一个；只是移出标签栏，不归档会话
          if (id === activeRef.current) {
            const rest = previous.filter((item) => item !== id);
            const fallback = rest[Math.max(0, index - 1)] || rest[0];
            if (fallback !== undefined) select(fallback);
          }
        },
        [select],
      );

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

      // 把 from 移到「插入位置 insert」（insert 按移动前的下标计）
      const moveTo = React.useCallback((from, insert) => {
        const prev = orderRef.current;
        const fromIndex = prev.indexOf(from);
        if (fromIndex < 0) return;
        let to = insert;
        if (to > fromIndex) to -= 1;
        if (to === fromIndex) return;
        const next = prev.slice();
        next.splice(fromIndex, 1);
        next.splice(to, 0, from);
        orderRef.current = next;
        tabs.commit(next);
      }, []);

      const dragStart = React.useCallback((id, event) => {
        const target = event.target;
        // 从关闭按钮上按下不进入拖拽
        if (target && typeof target.closest === 'function' && target.closest('.dsst-close')) {
          event.preventDefault();
          return;
        }
        dragId.current = id;
        draggingRef.current = true;
        setDraggingId(id);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          try {
            event.dataTransfer.setData('text/plain', id);
          } catch (error) {
            // 少数情况下 dataTransfer 只读，忽略即可
          }
        }
      }, []);

      const dragOver = React.useCallback(
        (id, event) => {
          const from = dragId.current;
          if (from === null || from === id) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          const targetIndex = orderRef.current.indexOf(id);
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

      return h(
        React.Fragment,
        null,
        h('style', { key: 'css' }, CSS),
        h(
          'div',
          { key: 'bar', className: 'dsst-bar', onDragOver: dragOverBar },
          order.map((id) =>
            h(MemoTab, {
              key: id,
              id,
              t,
              active: active === id,
              dragging: draggingId === id,
              fallbackTitle: titles[id],
              onSelect: select,
              onClose: closeTab,
              onDragStart: dragStart,
              onDragOver: dragOver,
              onDragEnd: dragEnd,
              useSessions,
              useSessionStatus,
            }),
          ),
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
      );
    }

    // 右键菜单「添加到 Tab」的图标：一个标签页轮廓 + 内部加号
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

    // 菜单是加分项：contextMenus 缺失时整条标签栏仍然工作
    function registerSessionMenu(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(
        () =>
          ctx.contextMenus.register({
            id: 'session.sessionTabs',
            target: 'session',
            // 排在“复制会话 ID”(450) 之后、“归档”(600) 之前
            order: 500,
            observe: () => [tabsSource, ctx.locale],
            resolve: (target) => {
              const present = tabs.has(target.sessionId);
              return [
                {
                  id: 'addToTab',
                  label: t('addToTab'),
                  icon: { key: 'session-tabs.add' },
                  disabled: present,
                  run: () => {
                    tabs.add(target.sessionId);
                  },
                },
              ];
            },
          }),
        'session-tabs: session menu entry',
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

        ctx.slots.inject('shell.bottom', () =>
          ctx.slots.register(
            {
              name: 'shell.bottom',
              id: 'session-tabs.bar',
              locale: NS,
              inject: () => ({ t, openSession, newSession }),
            },
            Bar,
          ),
        );

        // 侧栏会话右键菜单：已在标签栏中的会话置灰
        ctx.slots.inject('contextMenu.icon', () =>
          ctx.slots.register({ name: 'contextMenu.icon', key: 'session-tabs.add' }, TabIcon),
        );

        if (ctx.get('contextMenus')) registerSessionMenu(ctx);
        else if (typeof ctx.inject === 'function') {
          ctx.inject(['contextMenus'], (child) => registerSessionMenu(child));
        }
      },
    };
  },
});
