const routes = require('../../data/routes');
const { createExperienceController } = require('../../domain/experience-controller');
const { createLearningRepository } = require('../../services/learning-repository');
const { createLearningSession } = require('../../services/learning-session');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { getKnowledgeCard } = require('../../data/knowledge-cards');
const { getStepVideo } = require('../../data/candidate-videos');
const { createTrialAnalytics } = require('../../services/trial-analytics');
const { getNavTopPadding } = require('../../services/navigation-layout');
const {
  PLACEMENT_TARGET_THRESHOLD,
  evaluateCutGesture,
  resolvePlacementDrop,
  evaluateFinishHold,
  evaluateHammerGesture,
} = require('../../domain/craft-interaction');

const HAMMER_BEAT_MS = 900;

function createIdFactory() {
  return () => `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(-16).padStart(16, '0');
}

const STEP_COPY = {
  twist: { kicker: '01 · 做捻子', title: '校准尺寸，稳稳裁下三片', instruction: '按住裁刀沿尺线匀速推进；看金条切口和接片盘判断结果' },
  pack: { kicker: '02 · 装家生', title: '用镊子把薄金送进纸心', instruction: '移动过快金片会飘；进入乌金纸中心后减速、停稳、松开' },
  hammer: { kicker: '03 · 打箔', title: '追着光泽，让锤声落在节拍上', instruction: '移动锤头选择亮处，按住蓄力并在金点进入亮区时松手' },
  inspect: { kicker: '04 · 出具检查', title: '提灯迎光，找出三处厚薄', instruction: '拖动检视灯扫过箔面，在反光异常处停留片刻完成显影' },
  finish: { kicker: '05 · 切箔成叶', title: '让鹅毛真正抚过每一寸箔面', instruction: '连续刷过褶皱区域；覆盖完成后按住收尾，揭出完整方叶' },
};

const ASSIST_COPY = {
  twist: { title: '裁切总是差一点？', button: '帮我裁出 3 片合格捻子' },
  pack: { title: '金片不好对准？', button: '帮我居中装好乌金纸' },
  hammer: { title: '不知道该敲哪里？', button: '请工艺师补齐安全落点' },
  inspect: { title: '看不懂厚薄反光？', button: '带我完成出具检查' },
  finish: { title: '抚平手势不顺手？', button: '帮我抚平并完成成叶' },
};

const STEP_INPUT_COPY = {
  twist: '匀速推刀',
  pack: '夹取 · 减速 · 停稳',
  hammer: '选点 · 蓄力 · 合拍',
  inspect: '移动光源 · 停留显影',
  finish: '连续覆盖 · 静止收尾',
};

function describeMaterialMemory(stepId, session) {
  if (!stepId || !session) return '';
  if (stepId === 'twist') return '当前材料：未裁金条 · 合格切口才会进入接片盘';
  if (stepId === 'pack') return `承接裁切：${session.sheetCount} 片合格捻子等待装入乌金纸`;
  if (stepId === 'hammer') {
    const averageOffset = session.placements.length
      ? session.placements.reduce((sum, item) => sum + item.offset, 0) / session.placements.length
      : 0;
    return `承接装箔：三层${averageOffset <= .12 ? '基本居中，锤力较均匀' : '存在偏移，箔面厚薄已经受到影响'}`;
  }
  if (stepId === 'inspect') return `承接打箔：${session.metrics.riskCount} 处暗斑风险、${session.metrics.repairableCount} 处仍可处理`;
  return `承接前序：${session.metrics.quality === 'perfect' ? '箔面匀净' : session.metrics.quality === 'minor' ? '轻微瑕疵已保留' : '明显瑕疵已保留'}，抚平不会抹去真实结果`;
}

function deriveStepProgress(stepId, session, finishProgress) {
  if (!stepId || !session) return 0;
  if (stepId === 'twist') return Math.min(100, Math.round((session.sheetCount / 3) * 100));
  if (stepId === 'pack') return Math.min(100, Math.round((session.placements.length / 3) * 100));
  if (stepId === 'hammer') {
    const touchProgress = Math.min(75, Math.round((session.metrics.touchedCount / 12) * 75));
    return Math.min(100, touchProgress + (session.rotated ? 25 : 0));
  }
  if (stepId === 'inspect') return session.inspectionSweeps > 0 ? 100 : 0;
  if (stepId === 'finish') return finishProgress;
  return 0;
}

function describeInspectionArea(cell) {
  if (!cell) return '';
  const vertical = cell.row < 2 ? '上方' : '下方';
  const horizontal = cell.col < 2 ? '偏左' : '偏右';
  return `${vertical}${horizontal}`;
}

function inspectionMarker(state) {
  if (state === 'risk') return '险';
  if (state === 'thick') return '厚';
  if (state === 'thin') return '薄';
  return '匀';
}

Page({
  data: {
    phase: 'idle',
    demoMode: false,
    demoSecondsLeft: 90,
    demoExpired: false,
    displayStepNumber: 1,
    displayStepTotal: 5,
    routeName: '金箔锻制体验（候选内容）',
    step: null,
    taskMap: [],
    session: null,
    stepCopy: {},
    assistCopy: {},
    stepInputLabel: '',
    materialMemory: '',
    activeKnowledgeCard: null,
    isKnowledgeCardOpen: false,
    cutPosition: 24,
    cutFeedback: '把裁刀拖进中央标准区',
    cutStability: 0,
    cutMoving: false,
    cutRejectVisible: false,
    cutOutcomeTone: 'idle',
    placementX: -90,
    placementY: -50,
    placementTilt: -5,
    placementDrift: 0,
    placementSpeedLabel: '等待夹取',
    placementRejected: false,
    placementFeedback: '中央金框是理想位置',
    placementSettling: false,
    placementReady: false,
    hammerMessage: '先听示范：嗒 · 嗒 · 嗒',
    rhythmIntroActive: false,
    hammeredCellId: '',
    hammerWarningCellId: '',
    hammerPowerLabel: '轻触试锤',
    hammerPowerTone: 'neutral',
    hammerRhythmLabel: '等待第一锤',
    hammerRhythmTone: 'neutral',
    hammerImpactTone: 'steady',
    hammerPressedCellId: '',
    hammerCharge: 0,
    hammerScore: 0,
    hammerPerfectCount: 0,
    hammerGradeVisible: false,
    hammerGradeLabel: '',
    hammerGradeTone: 'good',
    hammerToolX: 82,
    hammerToolY: 14,
    isRotating: false,
    rotateUnlockRemaining: 8,
    inspectGlow: 16,
    inspectY: 76,
    inspectFeedback: '轻触一处箔面进行探查，最多选择 3 个位置',
    inspectDirectionHint: '观察光泽，选择一处你认为异常的位置',
    inspectScanning: false,
    inspectDwell: 0,
    inspectCandidateId: '',
    inspectionCells: [],
    decisionMessage: '',
    repairSuggested: false,
    finishProgress: 0,
    finishReady: false,
    finishHolding: false,
    finishX: 8,
    finishY: 70,
    finishFeedback: '按住鹅毛，缓慢横向抚过整张箔面',
    finishWarning: false,
    finishVisitedIds: [],
    finishTrail: [],
    finishReveal: false,
    finishCells: [],
    knowledgeFlash: '',
    isCelebrating: false,
    activeVideo: null,
    videoDone: false,
    debugGrid: false,
    beginnerMode: true,
    assistBusy: false,
    stepIndex: 0,
    stepProgress: 0,
    overallProgress: 0,
    sceneAnimating: false,
    momentVisible: false,
    momentText: '',
    momentTone: 'gold',
    cutSuccessBurst: false,
    packSuccessBurst: false,
    hammerCombo: 0,
    hammerReady: false,
    nextHammerHintId: '',
    inspectDiscoveryCount: 0,
    navRightPadding: 0,
    navTopPadding: 68,
    celebrationParticles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },

  onLoad(options = {}) {
    const demoMode = options.mode === 'demo';
    const routeId = routes.some((route) => route.id === options.routeId)
      ? options.routeId
      : demoMode ? 'foil_making_candidate' : null;
    if (!routeId) { wx.navigateBack({ delta: 1 }); return; }
    this.setData({ demoMode, displayStepTotal: demoMode ? 3 : 5, navTopPadding: getNavTopPadding(wx) });
    if (wx.getMenuButtonBoundingClientRect) {
      try {
        const capsule = wx.getMenuButtonBoundingClientRect();
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.setData({ navRightPadding: Math.max(0, windowInfo.windowWidth - capsule.left + 8) });
      } catch (error) { /* use the normal safe-area padding */ }
    }
    this.learningSession = null;
    if (!demoMode) {
      try {
        this.learningSession = createLearningSession({
          repository: createLearningRepository({
            routes,
            storage: createWxLearningStorage(wx),
            now: () => Date.now(),
            idFactory: createIdFactory(),
          }),
        });
      } catch (error) { this.learningSession = null; }
    }
    this.analytics = null;
    if (!demoMode) {
      try {
        this.analytics = createTrialAnalytics({
          storage: { get: (key) => Promise.resolve(wx.getStorageSync(key)), set: (key, value) => Promise.resolve(wx.setStorageSync(key, value)) },
          cloudCall: wx.cloud && wx.cloud.callFunction ? wx.cloud.callFunction.bind(wx.cloud) : () => Promise.reject(new Error('offline')),
          idFactory: () => `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(-16).padStart(16, '0'),
          clock: () => new Date(),
          routeId,
          capabilities: { continuousDrag: true, xrFrame: false, networkType: 'unknown' },
        });
      } catch (error) { this.analytics = null; }
    }
    this.controller = createExperienceController({
      routes,
      routeId,
      capabilities: { continuousDrag: true },
      now: () => Date.now(),
      track: demoMode ? () => undefined : (name, properties) => this.analytics && this.analytics.track(name, properties),
      learningSession: this.learningSession,
    });
    this.render();
  },

  onUnload() {
    clearTimeout(this.rhythmTimer);
    clearTimeout(this.hammerFeedbackTimer);
    clearTimeout(this.rotateTimer);
    clearTimeout(this.assistTimer);
    clearTimeout(this.sceneTimer);
    clearTimeout(this.momentTimer);
    clearTimeout(this.burstTimer);
    clearTimeout(this.completionTimer);
    clearTimeout(this.placeSettleTimer);
    clearTimeout(this.placeRejectTimer);
    clearTimeout(this.finishHoldTimer);
    clearTimeout(this.hammerPreviewTimer);
    clearTimeout(this.hammerGradeTimer);
    clearTimeout(this.cutLocalTimer);
    clearTimeout(this.inspectDwellTimer);
    clearInterval(this.inspectDwellTicker);
    clearInterval(this.hammerChargeTimer);
    clearInterval(this.demoTimer);
  },

  render() {
    const view = this.controller.getView();
    const previous = this.data.step && this.data.step.id;
    const stepId = view.step && view.step.id;
    const metrics = view.session.metrics;
    const stepIndex = Math.max(0, view.route.steps.findIndex((candidate) => candidate.id === stepId));
    const stepProgress = deriveStepProgress(stepId, view.session, this.data.finishProgress);
    const visibleStepIndex = this.data.demoMode ? Math.max(0, stepIndex - 2) : stepIndex;
    const visibleStepTotal = this.data.demoMode ? 3 : view.route.steps.length;
    const overallProgress = Math.min(100, Math.round(((visibleStepIndex + stepProgress / 100) / visibleStepTotal) * 100));
    const stepChanged = Boolean(stepId && previous !== stepId);
    const hammerReady = stepId === 'hammer' && view.session.rotated && metrics.untreatedCount <= 6 && view.session.reworkHitsRemaining <= 0;
    const nextHammerCell = stepId === 'hammer' && !hammerReady
      ? view.session.visualCells.find((cell) => cell.state === 'thick')
      : null;
    const resetInspection = stepId === 'inspect' && previous !== 'inspect' && view.session.inspectionSweeps < 1;
    if (resetInspection) this.inspectedCellIds = {};
    const resetFinish = stepId === 'finish' && previous !== 'finish';
    if (resetFinish) this.finishVisitedSet = {};
    const inspectedCellIds = this.inspectedCellIds || {};
    const inspectionCells = view.session.visualCells.map((cell) => ({
      ...cell,
      inspected: Boolean(inspectedCellIds[cell.id]),
      marker: inspectionMarker(cell.state),
    }));
    const finishVisitedSet = this.finishVisitedSet || {};
    const finishCells = view.session.visualCells.map((cell) => ({ ...cell, smoothed: Boolean(finishVisitedSet[cell.id]) }));
    const nextInspectionTarget = inspectionCells.find((cell) => !cell.inspected && cell.state === 'risk')
      || inspectionCells.find((cell) => !cell.inspected && cell.state === 'thick')
      || inspectionCells.find((cell) => !cell.inspected && cell.state === 'thin')
      || inspectionCells.find((cell) => !cell.inspected);
    const inspectDirectionHint = view.session.inspectionSweeps >= 1
      ? '探查完成，请根据结果选择定点补锤或接受当前状态'
      : this.data.beginnerMode && nextInspectionTarget
        ? `新手线索：留意${describeInspectionArea(nextInspectionTarget)}的反光`
        : '观察光泽差异，选择下一个探查位置';
    let decisionMessage = '状态均匀，可以进入切箔。';
    if (metrics.repairableCount > 0 && metrics.riskCount > 0) decisionMessage = `还有 ${metrics.repairableCount} 处厚区或盲区可补锤；同时避开 ${metrics.riskCount} 处暗斑。`;
    else if (metrics.repairableCount > 0) decisionMessage = `还有 ${metrics.repairableCount} 处厚区或盲区，建议返回定点补锤。`;
    else if (metrics.riskCount > 0) decisionMessage = `${metrics.riskCount} 处已经过薄，补锤无法修复；可接受瑕疵继续。`;
    this.setData({
      phase: view.phase,
      step: view.step,
      taskMap: this.data.demoMode ? view.taskMap.slice(2) : view.taskMap,
      session: view.session,
      inspectionCells,
      finishCells,
      stepCopy: stepId ? STEP_COPY[stepId] : {},
      assistCopy: stepId ? ASSIST_COPY[stepId] : {},
      stepInputLabel: stepId ? STEP_INPUT_COPY[stepId] : '',
      materialMemory: describeMaterialMemory(stepId, view.session),
      activeKnowledgeCard: stepId ? getKnowledgeCard(view.route.id, stepId) : null,
      activeVideo: stepId ? getStepVideo(stepId) : null,
      videoDone: this.data.demoMode ? true : previous === stepId ? this.data.videoDone : false,
      rotateUnlockRemaining: Math.max(0, 6 - metrics.touchedCount),
      decisionMessage,
      repairSuggested: metrics.repairableCount > 0,
      stepIndex,
      displayStepNumber: visibleStepIndex + 1,
      displayStepTotal: visibleStepTotal,
      stepProgress,
      overallProgress,
      sceneAnimating: stepChanged ? true : this.data.sceneAnimating,
      hammerReady,
      nextHammerHintId: nextHammerCell ? nextHammerCell.id : '',
      inspectDirectionHint,
      inspectDiscoveryCount: resetInspection ? 0 : this.data.inspectDiscoveryCount,
      inspectFeedback: resetInspection ? '拖动检视灯扫过箔面，在异常反光处停留显影' : this.data.inspectFeedback,
      inspectGlow: resetInspection ? 16 : this.data.inspectGlow,
      inspectY: resetInspection ? 76 : this.data.inspectY,
      finishTrail: resetFinish ? [] : this.data.finishTrail,
      finishReveal: resetFinish ? false : this.data.finishReveal,
    });
    if (stepChanged) {
      clearTimeout(this.sceneTimer);
      this.sceneTimer = setTimeout(() => this.setData({ sceneAnimating: false }), 420);
      if (previous) this.showMoment(`工序完成 · 进入${STEP_COPY[stepId].kicker.slice(5)}`);
    }
    if (stepId === 'hammer' && previous !== 'hammer') this.startRhythmIntro();
  },

  showMoment(text, tone = 'gold') {
    clearTimeout(this.momentTimer);
    this.setData({ momentVisible: true, momentText: text, momentTone: tone });
    this.momentTimer = setTimeout(() => this.setData({ momentVisible: false }), 1050);
  },

  startDemoCountdown() {
    clearInterval(this.demoTimer);
    this.demoStartedAt = Date.now();
    this.setData({ demoSecondsLeft: 90, demoExpired: false });
    this.demoTimer = setInterval(() => {
      const demoSecondsLeft = Math.max(0, 90 - Math.floor((Date.now() - this.demoStartedAt) / 1000));
      this.setData({ demoSecondsLeft });
      if (demoSecondsLeft > 0) return;
      clearInterval(this.demoTimer);
      this.demoTimer = null;
      this.setData({ demoExpired: true });
      this.showMoment('90 秒演示时间已到 · 仍可继续完成', 'gold');
    }, 1000);
  },

  startExperience() {
    if (this.data.demoMode) {
      this.controller.startDemo();
      this.render();
      this.startDemoCountdown();
      this.showMoment('演示模式 · 从打箔开始', 'green');
      return;
    }
    this.controller.start();
    this.render();
  },
  endIntro() { this.controller.endIntro(); this.render(); },
  completeCurrentStep() { this.controller.completeStep(); this.render(); },
  assistCurrentStep() {
    if (!this.data.step || this.data.assistBusy) return;
    this.showMoment('工艺师协助已启动', 'green');
    if (this.data.step.id === 'finish') {
      this.finishVisitedSet = {};
      (this.data.session.visualCells || []).forEach((cell) => { this.finishVisitedSet[cell.id] = true; });
      this.setData({
        assistBusy: true,
        finishProgress: 100,
        finishReady: true,
        finishReveal: true,
        finishCells: (this.data.session.visualCells || []).map((cell) => ({ ...cell, smoothed: true })),
        finishHolding: false,
        finishX: 88,
        finishY: 50,
        stepProgress: 100,
        overallProgress: 100,
        finishFeedback: '工艺师已帮你顺着箔面轻柔抚平，可以成叶了',
        knowledgeFlash: '新手护航只补足操作；前序形成的薄区与瑕疵仍会保留。',
      });
      this.assistTimer = setTimeout(() => {
        this.setData({ assistBusy: false });
        this.finishExperience();
      }, 420);
      return;
    }
    this.setData({ assistBusy: true, knowledgeFlash: '工艺师正在补足未完成部分；已有薄区与瑕疵仍会保留。' });
    this.assistTimer = setTimeout(() => {
      this.controller.assistStep();
      this.setData({ assistBusy: false });
      this.render();
    }, 320);
  },
  async exitExperience() {
    if (this.isExiting) return;
    this.isExiting = true;
    this.controller.exit();
    clearInterval(this.demoTimer);
    await this.controller.whenLearningSettled();
    if (this.data.demoMode && wx.reLaunch) wx.reLaunch({ url: '/pages/home/index' });
    else wx.navigateBack({ delta: 1 });
  },
  toggleKnowledgeCard() { this.setData({ isKnowledgeCardOpen: !this.data.isKnowledgeCardOpen }); },
  onVideoEnded() { this.setData({ videoDone: true }); },
  onVideoError() { this.setData({ videoDone: true }); },
  skipVideo() { this.setData({ videoDone: true }); },

  showHint() {
    this.controller.hint();
    const hints = {
      twist: '标准区在 44%—56% 之间。',
      pack: '越靠近中央，初始厚度越容易均匀。',
      hammer: '高光偏强处仍厚；哑光暗区已薄；带暗斑处不要再敲。',
      inspect: '厚区或盲区可补锤，暗斑风险区不能通过补锤修复。',
      finish: '缓慢抚平，避免在暗薄区域留下新的细裂。',
    };
    this.setData({ knowledgeFlash: hints[this.data.step.id] });
    this.render();
  },

  retryStep() {
    this.controller.retry();
    this.setData({ knowledgeFlash: '本任务可继续调整，前序工艺状态已保留。' });
    this.render();
  },

  onCutStart(event) {
    if (this.data.session.sheetCount >= 3) {
      this.setData({ cutFeedback: '3 片捻子已经备齐，请进入下一道工序' });
      return;
    }
    const point = event.touches[0];
    const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    this.cutStartX = point.clientX;
    this.cutBasePosition = this.data.cutPosition;
    this.cutPrevious = { x: point.clientX, at: timestamp };
    this.cutSpeeds = [];
    this.cutTravel = 0;
    clearTimeout(this.cutLocalTimer);
    this.setData({ cutMoving: true, cutStability: 0, cutRejectVisible: false, cutOutcomeTone: 'idle', cutFeedback: '裁刀已经压住金条，保持匀速送入中央尺线' });
  },
  onCutMove(event) {
    if (this.cutStartX === undefined || this.data.session.sheetCount >= 3) return;
    const point = event.touches[0];
    const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    const delta = point.clientX - this.cutStartX;
    const sampleDistance = Math.abs(point.clientX - this.cutPrevious.x);
    const elapsed = Math.max(1, timestamp - this.cutPrevious.at);
    if (sampleDistance > 0) {
      this.cutSpeeds.push(sampleDistance / elapsed);
      if (this.cutSpeeds.length > 12) this.cutSpeeds.shift();
      this.cutTravel += sampleDistance;
    }
    const gesture = evaluateCutGesture({
      speeds: this.cutSpeeds,
      distance: this.cutTravel,
      beginner: this.data.beginnerMode,
    });
    this.cutPrevious = { x: point.clientX, at: timestamp };
    this.setData({
      cutPosition: Math.max(12, Math.min(88, this.cutBasePosition + delta / 3)),
      cutStability: gesture.stability,
    });
  },
  onCutEnd() {
    if (this.data.session.sheetCount >= 3) {
      this.cutStartX = undefined;
      this.cutBasePosition = null;
      this.cutPrevious = null;
      this.cutSpeeds = [];
      this.cutTravel = 0;
      this.setData({ cutFeedback: '3 片捻子已经备齐，请进入下一道工序', cutMoving: false });
      this.showMoment('捻子已满 · 进入装家生', 'green');
      return;
    }
    const rawRatio = this.data.cutPosition / 50;
    const canAssistSnap = this.data.beginnerMode && rawRatio >= .72 && rawRatio <= 1.28;
    const ratio = canAssistSnap ? Math.max(.88, Math.min(1.12, rawRatio)) : rawRatio;
    const gesture = evaluateCutGesture({
      speeds: this.cutSpeeds,
      distance: this.cutTravel,
      beginner: this.data.beginnerMode,
    });
    this.controller.cut(ratio, gesture.stable);
    this.cutStartX = undefined;
    this.cutBasePosition = null;
    this.cutPrevious = null;
    this.cutSpeeds = [];
    this.cutTravel = 0;
    const accepted = gesture.stable && ratio >= .82 && ratio <= 1.18;
    const cutOutcomeTone = accepted
      ? 'success'
      : !gesture.enoughTravel || ratio < .82
        ? 'short'
        : !gesture.stable
          ? 'frayed'
          : 'long';
    const isNowFull = this.controller.getView().session.sheetCount >= 3;
    this.setData({
      cutFeedback: isNowFull
        ? '3 片捻子已经备齐，可以进入下一道工序'
        : !gesture.enoughTravel
          ? '这次移动太短，没有计入；请按住裁刀连续推入标准区'
          : !gesture.stable
            ? '裁刀速度变化太快，没有计入；放慢并保持匀速'
            : canAssistSnap && rawRatio !== ratio
          ? '接近标准区，已辅助吸附：一片捻子完成'
          : accepted
            ? '尺寸合适：一片捻子完成'
            : ratio < .82
              ? '这片明显过小，没有计入；请拖到中央标准区'
              : '这片明显过大，没有计入；请拖回中央标准区',
      knowledgeFlash: accepted ? '金条被分成小金片，才能逐张装入乌金纸。' : '',
      cutPosition: 24,
      cutMoving: false,
      cutStability: 0,
      cutOutcomeTone,
      cutRejectVisible: !accepted,
    });
    this.render();
    if (accepted) {
      this.setData({ cutSuccessBurst: true });
      this.showMoment(isNowFull ? '3 片捻子已备齐' : `合格捻子 +1 · ${this.data.session.sheetCount}/3`, 'green');
      clearTimeout(this.burstTimer);
      this.burstTimer = setTimeout(() => this.setData({ cutSuccessBurst: false }), 520);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } else {
      clearTimeout(this.cutLocalTimer);
      this.cutLocalTimer = setTimeout(() => this.setData({ cutRejectVisible: false, cutOutcomeTone: 'idle' }), 620);
    }
  },

  onPlaceStart(event) {
    if (this.data.session.placements.length >= 3) {
      this.setData({ placementFeedback: '3 张金片已经装好，请合上夹层进入下一步' });
      return;
    }
    const point = event.touches[0];
    const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    this.placeStart = { x: point.clientX, y: point.clientY };
    this.placeBase = { x: this.data.placementX, y: this.data.placementY };
    this.placePrevious = { x: point.clientX, y: point.clientY, at: timestamp };
    clearTimeout(this.placeSettleTimer);
    this.placeSettleTimer = null;
    clearTimeout(this.placeRejectTimer);
    this.setData({ placementSettling: false, placementReady: false, placementRejected: false, placementDrift: 0, placementSpeedLabel: '镊子已夹稳', placementFeedback: '轻移镊子；薄金会把你的速度直接表现出来' });
  },
  onPlaceMove(event) {
    if (!this.placeStart || this.data.session.placements.length >= 3) return;
    const point = event.touches[0];
    const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    const elapsed = Math.max(1, timestamp - this.placePrevious.at);
    const moveX = point.clientX - this.placePrevious.x;
    const moveY = point.clientY - this.placePrevious.y;
    const stepDistance = Math.hypot(moveX, moveY);
    const speed = stepDistance / elapsed;
    const placementX = Math.max(-100, Math.min(100, this.placeBase.x + point.clientX - this.placeStart.x));
    const placementY = Math.max(-75, Math.min(75, this.placeBase.y + point.clientY - this.placeStart.y));
    const rawOffset = Math.hypot(placementX / 100, placementY / 75);
    this.placePrevious = { x: point.clientX, y: point.clientY, at: timestamp };
    const canSettle = rawOffset <= PLACEMENT_TARGET_THRESHOLD && (this.data.beginnerMode || speed <= .75);
    if (canSettle && !this.data.placementReady && !this.placeSettleTimer) {
      this.setData({ placementSettling: true, placementFeedback: '已进入金框，保持不动完成压合' });
      this.placeSettleTimer = setTimeout(() => {
        this.placeSettleTimer = null;
        if (!this.placeStart) return;
        this.setData({ placementSettling: false, placementReady: true, placementFeedback: '位置已稳住，松手放入这一层' });
      }, this.data.beginnerMode ? 220 : 380);
    } else if (!canSettle && (this.data.placementSettling || this.data.placementReady)) {
      clearTimeout(this.placeSettleTimer);
      this.placeSettleTimer = null;
      this.setData({
        placementSettling: false,
        placementReady: false,
        placementFeedback: rawOffset > PLACEMENT_TARGET_THRESHOLD ? '继续靠近中央金框' : '进入目标区后再慢一点',
      });
    }
    this.setData({
      placementX,
      placementY,
      placementTilt: Math.max(-10, Math.min(10, Math.round(moveX * 1.2))),
      placementDrift: Math.min(12, Math.round(speed * 12)),
      placementSpeedLabel: canSettle ? '慢速归中' : speed > 1.1 ? '过快 · 金片飘动' : '移动中',
    });
  },
  onPlaceEnd() {
    if (this.data.session.placements.length >= 3) {
      this.placeStart = null;
      this.placeBase = null;
      this.placePrevious = null;
      clearTimeout(this.placeSettleTimer);
      this.placeSettleTimer = null;
      this.setData({ placementFeedback: '3 张金片已经装好，请合上夹层进入下一步', placementSettling: false, placementReady: false });
      this.showMoment('装家生已满 · 请合上夹层', 'green');
      return;
    }
    const rawX = this.data.placementX / 100;
    const rawY = this.data.placementY / 75;
    const placement = resolvePlacementDrop({
      x: rawX,
      y: rawY,
      settled: this.data.placementReady,
      beginner: this.data.beginnerMode,
    });
    if (placement.accepted) {
      this.controller.place(placement.x, placement.y);
      const isNowFull = this.controller.getView().session.placements.length >= 3;
      this.setData({
        placementFeedback: isNowFull
          ? '3 张金片已经装好，可以合上夹层'
          : placement.assistedSettle
            ? '已帮你减速归中并放入一层。'
            : '已放入一层；乌金纸会隔开每张金片。',
        knowledgeFlash: '乌金纸既传递锤力，也防止极薄金箔粘连。',
        placementX: -90,
        placementY: -50,
        placementTilt: -5,
        placementDrift: 0,
        placementSpeedLabel: isNowFull ? '三层装填完成' : '下一片等待夹取',
        placementRejected: false,
        placementSettling: false,
        placementReady: false,
      });
    } else this.setData({
      placementFeedback: placement.nearTarget ? '已经靠近中心，但还没有停稳；请放慢并短暂停留' : '明显跑偏：拖回中央再松手，不会自动归位。',
      placementDrift: 0,
      placementSpeedLabel: placement.nearTarget ? '未停稳' : '位置偏离',
      placementRejected: true,
      placementSettling: false,
      placementReady: false,
    });
    this.placeStart = null;
    this.placeBase = null;
    this.placePrevious = null;
    clearTimeout(this.placeSettleTimer);
    this.placeSettleTimer = null;
    this.render();
    if (placement.accepted) {
      this.setData({ packSuccessBurst: true });
      this.showMoment(this.data.session.placements.length >= 3 ? '3 张金片已装好' : `乌金纸入层 +1 · ${this.data.session.placements.length}/3`, 'green');
      clearTimeout(this.burstTimer);
      this.burstTimer = setTimeout(() => this.setData({ packSuccessBurst: false }), 560);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } else {
      clearTimeout(this.placeRejectTimer);
      this.placeRejectTimer = setTimeout(() => this.setData({ placementRejected: false }), 520);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    }
  },

  startRhythmIntro() {
    this.lastHammerAt = null;
    this.hammerPress = null;
    this.rhythmClockStartedAt = Date.now();
    const resetScore = this.data.session && this.data.session.metrics.touchedCount === 0 && this.data.session.reworkHitsRemaining <= 0;
    this.setData({
      rhythmIntroActive: true,
      hammerMessage: '看准节拍轨道中央的金色窗口，再按住落锤',
      hammerPressedCellId: '',
      hammerCharge: 0,
      hammerScore: resetScore ? 0 : this.data.hammerScore,
      hammerPerfectCount: resetScore ? 0 : this.data.hammerPerfectCount,
    });
    clearTimeout(this.rhythmTimer);
    this.rhythmTimer = setTimeout(() => this.setData({ rhythmIntroActive: false, hammerMessage: '观察光泽选择落点，避开已经发暗的薄区' }), 1700);
  },

  previewHammerCell(event) {
    if (this.data.isRotating || this.data.hammerReady) return;
    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    const cell = this.data.session.visualCells.find((item) => item.row === row && item.col === col);
    if (!cell) return;
    this.hammerPress = {
      id: cell.id,
      at: Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now(),
      wallAt: Date.now(),
    };
    clearInterval(this.hammerChargeTimer);
    this.setData({
      hammerPressedCellId: cell.id,
      hammerCharge: 0,
      hammerGradeVisible: false,
      hammerToolX: 16 + (col + .5) * 17,
      hammerToolY: 19 + (row + .5) * 17,
    });
    this.hammerChargeTimer = setInterval(() => {
      if (!this.hammerPress || this.hammerPress.id !== cell.id) return;
      const duration = Date.now() - this.hammerPress.wallAt;
      const hammerCharge = Math.min(100, Math.round((duration / 480) * 100));
      const previewPower = duration < 60 ? '轻' : duration <= 360 ? '稳' : '重';
      this.setData({ hammerCharge, hammerPowerLabel: `蓄力 · ${previewPower}` });
    }, 40);
    clearTimeout(this.hammerPreviewTimer);
    if (cell.value <= 42) {
      this.setData({
        hammerWarningCellId: cell.id,
        hammerMessage: this.data.beginnerMode
          ? '危险预警：这里已经很薄，新手护航会阻止落锤'
          : '危险预警：这里已经很薄，继续落锤可能形成暗斑',
      });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } else {
      this.setData({ hammerWarningCellId: '', hammerMessage: '落点仍有厚度，松手即可落锤' });
    }
    this.hammerPreviewTimer = setTimeout(() => this.setData({ hammerWarningCellId: '' }), 760);
  },

  cancelHammerPress() {
    clearInterval(this.hammerChargeTimer);
    this.hammerChargeTimer = null;
    this.hammerPress = null;
    this.setData({ hammerPressedCellId: '', hammerCharge: 0 });
  },

  hammerCell(event) {
    if (this.data.isRotating) return;
    if (this.data.hammerReady) {
      this.setData({ hammerMessage: '打箔已经达到本次体验要求，请展开检查' });
      this.showMoment('打箔已完成 · 请展开检查', 'green');
      return;
    }
    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    const before = this.data.session.visualCells.find((cell) => cell.row === row && cell.col === col);
    const hitAt = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    const pressDurationMs = this.hammerPress && before && this.hammerPress.id === before.id
      ? Math.max(0, hitAt - this.hammerPress.at)
      : 0;
    const intervalMs = this.lastHammerAt === null || this.lastHammerAt === undefined ? null : Math.max(0, hitAt - this.lastHammerAt);
    const beatPhase = this.rhythmClockStartedAt
      ? ((Date.now() - this.rhythmClockStartedAt) % HAMMER_BEAT_MS) / HAMMER_BEAT_MS
      : null;
    const gesture = evaluateHammerGesture({ pressDurationMs, intervalMs, beatPhase });
    const powerLabels = { light: '偏轻', steady: '稳劲', heavy: '偏重' };
    const rhythmLabels = gesture.beat
      ? { perfect: '正中节拍', good: '接近节拍', miss: '错过节拍' }
      : { first: '第一锤', rushed: '稍快', steady: '合拍', late: '稍慢' };
    const rhythmKey = gesture.beat || gesture.rhythm;
    clearInterval(this.hammerChargeTimer);
    this.hammerChargeTimer = null;
    this.hammerPress = null;
    if (this.data.beginnerMode && before && before.value <= 42) {
      clearTimeout(this.hammerPreviewTimer);
      this.setData({
        hammerWarningCellId: before.id,
        hammerMessage: '已拦住危险落锤：请改敲有高光的厚区',
        hammerCombo: 0,
        hammerPressedCellId: '',
        hammerCharge: 0,
        hammerPowerLabel: powerLabels[gesture.power],
        hammerPowerTone: gesture.power === 'steady' ? 'good' : 'warn',
        hammerRhythmLabel: '危险落点',
        hammerRhythmTone: 'warn',
      });
      this.showMoment('危险落点已拦截 · 金箔没有受损', 'red');
      this.hammerPreviewTimer = setTimeout(() => this.setData({ hammerWarningCellId: '' }), 760);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
      return;
    }
    this.lastHammerAt = hitAt;
    this.controller.hammer(row, col);
    this.render();
    const after = this.data.session.visualCells.find((cell) => cell.row === row && cell.col === col);
    const safeHit = after.value >= 24 && before.value > 42;
    const balancedHit = safeHit && gesture.isBalanced;
    const hammerCombo = balancedHit ? Math.min(9, this.data.hammerCombo + 1) : 0;
    const perfectHit = safeHit && gesture.power === 'steady' && gesture.beat === 'perfect';
    const goodHit = safeHit && gesture.power === 'steady' && gesture.beat === 'good';
    const scoreGain = perfectHit ? 100 : goodHit ? 70 : safeHit ? 35 : 0;
    const hammerGradeLabel = perfectHit ? '金声 · 绝佳' : goodHit ? '稳准 · 漂亮' : safeHit ? '落点有效' : '换个亮处';
    const hammerGradeTone = perfectHit ? 'perfect' : goodHit ? 'good' : safeHit ? 'normal' : 'danger';
    this.setData({
      hammerMessage: this.data.hammerReady ? '打箔已经达到本次体验要求，请展开检查' : perfectHit ? '正中节拍，锤力沿箔面均匀散开' : goodHit ? '节拍接近，金片正在稳定延展' : after.value < 24 ? '警示：暗斑扩大，这里已经过薄' : '落点有效；试着让金点进入中央窗口时落锤',
      knowledgeFlash: '落点与节奏共同决定金片能否均匀延展。',
      hammeredCellId: `${row}-${col}`,
      hammerWarningCellId: '',
      hammerCombo,
      hammerPressedCellId: '',
      hammerCharge: 0,
      hammerScore: this.data.hammerScore + scoreGain,
      hammerPerfectCount: this.data.hammerPerfectCount + (perfectHit ? 1 : 0),
      hammerGradeVisible: true,
      hammerGradeLabel,
      hammerGradeTone,
      hammerPowerLabel: powerLabels[gesture.power],
      hammerPowerTone: gesture.power === 'steady' ? 'good' : 'warn',
      hammerRhythmLabel: rhythmLabels[rhythmKey],
      hammerRhythmTone: gesture.beat === 'perfect' ? 'perfect' : gesture.isBalanced ? 'good' : 'warn',
      hammerImpactTone: gesture.power,
    });
    this.showMoment(
      this.data.hammerReady
        ? '打箔达标 · 落锤区已锁定'
        : balancedHit
          ? `稳劲合拍 · 连击 ×${hammerCombo}`
          : after.value < 24
            ? '这里已经过薄，换个亮处'
          : `${powerLabels[gesture.power]} · ${rhythmLabels[rhythmKey]}`,
      this.data.hammerReady || balancedHit ? 'green' : after.value < 24 ? 'red' : 'gold',
    );
    clearTimeout(this.hammerFeedbackTimer);
    this.hammerFeedbackTimer = setTimeout(() => this.setData({ hammeredCellId: '' }), 360);
    clearTimeout(this.hammerGradeTimer);
    this.hammerGradeTimer = setTimeout(() => this.setData({ hammerGradeVisible: false }), 620);
    if (wx.vibrateShort) wx.vibrateShort({ type: after.value < 24 ? 'heavy' : perfectHit ? 'medium' : 'light' });
  },

  rotatePack() {
    if (this.data.session.rotated || this.data.rotateUnlockRemaining > 0 || this.data.isRotating) {
      if (this.data.session.rotated) this.showMoment('箔包已经旋转完成，无需重复操作', 'green');
      return;
    }
    this.setData({ isRotating: true, hammerMessage: '正在旋转箔包，重新暴露落锤盲区…' });
    this.rotateTimer = setTimeout(() => {
      this.controller.rotatePack();
      this.render();
      this.setData({ isRotating: false, hammerMessage: this.data.hammerReady ? '旋转后覆盖已达标，可以展开检查' : '箔包已旋转 90°，继续处理剩余暗区', hammerCombo: 0 });
      this.showMoment(this.data.hammerReady ? '旋转完成 · 打箔已经达标' : '旋转完成 · 新落点已显现', 'green');
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    }, 460);
  },

  revealInspectionCell(row, col) {
    if (this.data.session.inspectionSweeps >= 1) {
      this.setData({ inspectFeedback: '三次探查已经完成，请选择补锤或接受当前状态' });
      return;
    }
    const cell = this.data.session.visualCells.find((item) => item.row === row && item.col === col);
    if (!cell) return;
    this.inspectedCellIds = this.inspectedCellIds || {};
    if (this.inspectedCellIds[cell.id]) {
      this.setData({ inspectFeedback: '这个位置已经探查过，请选择另一处光泽不同的区域' });
      return;
    }
    this.inspectedCellIds[cell.id] = true;
    const inspectDiscoveryCount = Math.min(3, this.data.inspectDiscoveryCount + 1);
    const inspectFeedback = cell.state === 'risk'
      ? '发现暗斑透光：这里已经过薄，不能再锤'
      : cell.state === 'thick'
        ? '发现强反光：这里仍偏厚，可以定点补锤'
        : cell.state === 'ideal'
          ? '高光细密均匀：这里厚度接近理想'
          : '光泽偏暗：这里已经较薄，后续需要避开';
    this.setData({
      inspectDiscoveryCount,
      inspectFeedback,
      inspectGlow: col * 25 + 12.5,
      inspectY: row * 25 + 12.5,
      inspectDwell: 0,
      inspectCandidateId: '',
      knowledgeFlash: inspectDiscoveryCount >= 3 ? '三处局部结果已经汇合，现在可以判断是否返工。' : '',
    });
    if (inspectDiscoveryCount >= 3) this.controller.sweepInspection();
    this.render();
    this.showMoment(
      inspectDiscoveryCount >= 3 ? '三次探查完成 · 判断已解锁' : `局部探查 ${inspectDiscoveryCount} / 3`,
      inspectDiscoveryCount >= 3 ? 'green' : 'gold',
    );
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  beginInspectionCandidate(row, col) {
    if (this.data.session.inspectionSweeps >= 1) return;
    const cell = this.data.session.visualCells.find((item) => item.row === row && item.col === col);
    if (!cell) return;
    if (this.inspectedCellIds && this.inspectedCellIds[cell.id]) {
      clearInterval(this.inspectDwellTicker);
      this.inspectDwellTicker = null;
      this.setData({ inspectCandidateId: '', inspectDwell: 0, inspectFeedback: '这里已经显影，请把检视灯移向另一处光泽' });
      return;
    }
    if (this.data.inspectCandidateId === cell.id && this.inspectDwellTicker) return;
    clearInterval(this.inspectDwellTicker);
    const requiredMs = this.data.beginnerMode ? 260 : 420;
    this.inspectCandidateStartedAt = Date.now();
    this.setData({ inspectCandidateId: cell.id, inspectDwell: 0, inspectFeedback: '发现反光变化，保持检视灯不动让纹理显影' });
    this.inspectDwellTicker = setInterval(() => {
      if (!this.data.inspectScanning || this.data.inspectCandidateId !== cell.id) return;
      const inspectDwell = Math.min(100, Math.round(((Date.now() - this.inspectCandidateStartedAt) / requiredMs) * 100));
      this.setData({ inspectDwell });
      if (inspectDwell < 100) return;
      clearInterval(this.inspectDwellTicker);
      this.inspectDwellTicker = null;
      this.revealInspectionCell(row, col);
    }, 40);
  },

  updateInspectionBeam(point) {
    if (!this.inspectRect || !point) return;
    const x = Math.max(0, Math.min(99.9, ((point.clientX - this.inspectRect.left) / this.inspectRect.width) * 100));
    const y = Math.max(0, Math.min(99.9, ((point.clientY - this.inspectRect.top) / this.inspectRect.height) * 100));
    const col = Math.min(3, Math.floor(x / 25));
    const row = Math.min(3, Math.floor(y / 25));
    this.setData({ inspectGlow: Math.round(x), inspectY: Math.round(y) });
    this.beginInspectionCandidate(row, col);
  },

  onInspectStart(event) {
    if (this.data.session.inspectionSweeps >= 1) return;
    const point = event.touches[0];
    this.setData({ inspectScanning: true, inspectFeedback: '检视灯已点亮，缓慢扫过箔面寻找异常反光' });
    wx.createSelectorQuery().in(this).select('.inspection-surface').boundingClientRect((rect) => {
      if (!rect || !this.data.inspectScanning) return;
      this.inspectRect = rect;
      this.updateInspectionBeam(point);
    }).exec();
  },

  onInspectMove(event) {
    if (!this.data.inspectScanning || !event.touches[0]) return;
    this.updateInspectionBeam(event.touches[0]);
  },

  onInspectEnd() {
    clearInterval(this.inspectDwellTicker);
    this.inspectDwellTicker = null;
    this.inspectRect = null;
    this.setData({ inspectScanning: false, inspectDwell: 0, inspectCandidateId: '' });
  },

  probeInspectionCell(event) {
    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    this.revealInspectionCell(row, col);
  },
  returnToHammer() {
    if (this.data.session.inspectionSweeps < 1 || !this.data.repairSuggested) {
      this.setData({ inspectFeedback: this.data.session.inspectionSweeps < 1 ? '请先完成三次局部探查' : '当前没有适合补锤的厚区，可以直接接受结果' });
      return;
    }
    this.controller.returnToHammer();
    this.render();
    clearTimeout(this.rhythmTimer);
    this.setData({ rhythmIntroActive: false, hammerMessage: '返修模式：请选择一处高光偏强的厚区补锤' });
    this.showMoment('已开放 1 次安全补锤机会', 'green');
  },
  acceptInspection() { this.controller.acceptInspection(); this.render(); },

  beginFinishHold(point) {
    clearTimeout(this.finishHoldTimer);
    const hold = evaluateFinishHold({ durationMs: 0, movement: 0, beginner: this.data.beginnerMode });
    this.finishHoldStartedAt = Date.now();
    this.finishHoldAnchor = { x: point.clientX, y: point.clientY };
    this.finishHoldMovement = 0;
    this.setData({ finishHolding: true, finishFeedback: '抚平完成，保持不动完成最后收尾' });
    this.finishHoldTimer = setTimeout(() => {
      this.finishHoldTimer = null;
      const result = evaluateFinishHold({
        durationMs: Date.now() - this.finishHoldStartedAt,
        movement: this.finishHoldMovement,
        beginner: this.data.beginnerMode,
      });
      if (!this.smoothStart || !result.stable) {
        this.setData({ finishHolding: false, finishFeedback: '还差最后一次稳定收尾，按住箔面保持不动' });
        return;
      }
      this.setData({
        finishReady: true,
        finishHolding: false,
        finishReveal: true,
        finishFeedback: '箔面已经抚平并稳定，可以沿线切成标准方叶',
        knowledgeFlash: '连续抚平和稳定收尾都已完成；前序厚薄与细裂仍被保留。',
      });
      this.showMoment('稳定收尾完成 · 可以成叶', 'green');
      if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
    }, hold.requiredMs);
  },

  onSmoothStart(event) {
    if (this.data.isCelebrating || this.data.finishReady) {
      this.setData({ finishFeedback: '箔面已经抚平，请沿线切成标准方叶' });
      this.showMoment('抚平已完成 · 请成叶', 'green');
      return;
    }
    const point = event.touches[0];
    this.smoothStart = { x: point.clientX, y: point.clientY, at: event.timeStamp || Date.now() };
    this.smoothPrevious = { ...this.smoothStart };
    if (this.data.finishProgress >= 100) this.beginFinishHold(point);
    if (wx.createSelectorQuery) {
      wx.createSelectorQuery().in(this).select('.final-foil').boundingClientRect((rect) => { this.finishRect = rect; }).exec();
    }
  },
  onSmoothMove(event) {
    if (!this.smoothStart || this.data.finishReady) return;
    const point = event.touches[0];
    if (this.data.finishProgress >= 100) {
      if (this.finishHoldAnchor) {
        this.finishHoldMovement = Math.max(
          this.finishHoldMovement,
          Math.hypot(point.clientX - this.finishHoldAnchor.x, point.clientY - this.finishHoldAnchor.y),
        );
        const allowedDrift = this.data.beginnerMode ? 18 : 10;
        if (this.finishHoldMovement > allowedDrift && this.data.finishHolding) {
          clearTimeout(this.finishHoldTimer);
          this.finishHoldTimer = null;
          this.setData({ finishHolding: false, finishFeedback: '收尾时移动得有些多，请松手后再按住保持不动' });
        }
      }
      return;
    }
    const timestamp = event.timeStamp || Date.now();
    const rect = this.finishRect || { left: this.smoothStart.x - 20, top: this.smoothStart.y - 120, width: 300, height: 300 };
    const travel = Math.abs(point.clientX - this.smoothPrevious.x);
    const elapsed = Math.max(1, timestamp - this.smoothPrevious.at);
    const speed = travel / elapsed;
    const previousProgress = this.data.finishProgress;
    const finishProgress = Math.min(100, previousProgress + (travel / (rect.width * (this.data.beginnerMode ? .72 : 1.8))) * 100);
    const x = Math.max(2, Math.min(96, ((point.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(94, ((point.clientY - rect.top) / rect.height) * 100));
    const row = Math.min(3, Math.floor(y / 25));
    const col = Math.min(3, Math.floor(x / 25));
    const cell = this.data.session.visualCells.find((item) => item.row === row && item.col === col);
    this.finishVisitedSet = this.finishVisitedSet || {};
    let finishCells = this.data.finishCells;
    let finishTrail = this.data.finishTrail;
    if (cell && !this.finishVisitedSet[cell.id]) {
      this.finishVisitedSet[cell.id] = true;
      finishCells = this.data.finishCells.map((item) => (item.id === cell.id ? { ...item, smoothed: true } : item));
      finishTrail = [...this.data.finishTrail, { id: cell.id, x: Math.round(x), y: Math.round(y) }].slice(-8);
    }
    let finishFeedback = '褶皱正沿着鹅毛划过的路径慢慢舒展';
    let finishWarning = false;
    if (!this.data.beginnerMode && speed > 1.35 && cell && (cell.state === 'thin' || cell.state === 'risk') && this.lastStressedCellId !== cell.id) {
      this.lastStressedCellId = cell.id;
      this.controller.stressFinish(row, col);
      this.render();
      finishFeedback = '动作过快，薄区出现了一处新的细裂';
      finishWarning = true;
      if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
    }
    this.setData({
      finishProgress: Math.round(finishProgress),
      finishX: Math.round(x),
      finishY: Math.round(y),
      finishFeedback,
      finishWarning,
      finishCells,
      finishTrail,
      stepProgress: Math.round(finishProgress),
      overallProgress: Math.round((this.data.demoMode ? 200 / 3 : 80) + finishProgress / (this.data.demoMode ? 3 : 5)),
    });
    const milestone = [25, 50, 75, 100].find((value) => previousProgress < value && finishProgress >= value);
    if (milestone) this.showMoment(milestone === 100 ? '箔面已舒展 · 保持不动收尾' : `箔面舒展 ${milestone}%`, milestone === 100 ? 'green' : 'gold');
    if (finishProgress >= 100 && !this.data.finishHolding) this.beginFinishHold(point);
    this.smoothPrevious = { x: point.clientX, y: point.clientY, at: timestamp };
  },
  onSmoothEnd() {
    if (!this.smoothStart) return;
    if (this.data.finishHolding && !this.data.finishReady) {
      clearTimeout(this.finishHoldTimer);
      this.finishHoldTimer = null;
      this.setData({ finishHolding: false, finishFeedback: '抚平已到 100%，再按住箔面保持片刻完成收尾' });
    }
    this.smoothStart = null;
    this.smoothPrevious = null;
    this.finishRect = null;
    this.finishHoldAnchor = null;
    this.finishHoldStartedAt = 0;
    this.finishHoldMovement = 0;
    this.lastStressedCellId = '';
    this.setData({
      knowledgeFlash: this.data.finishReady
        ? '鹅毛完成展平；厚薄与细裂仍真实保留在这一叶金上。'
        : this.data.finishProgress >= 100
          ? '进度已经完成；最后按住箔面稳定片刻即可成叶。'
          : '继续缓慢抚平尚未舒展的区域。',
    });
  },

  async finishExperience() {
    if (!this.data.finishReady || this.data.isCelebrating) return;
    clearInterval(this.demoTimer);
    this.controller.completeStep();
    const result = this.controller.exportResult();
    wx.setStorageSync(this.data.demoMode ? 'latest_foil_demo_result' : 'latest_foil_result', result);
    this.setData({ isCelebrating: true });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy' });
    const report = this.data.demoMode ? null : await this.controller.whenLearningSettled();
    const modeQuery = this.data.demoMode ? '&mode=demo' : '';
    const reportQuery = report && typeof report.reportId === 'string' ? `&reportId=${encodeURIComponent(report.reportId)}` : '';
    this.completionTimer = setTimeout(() => wx.redirectTo({ url: `/pages/result/index?routeId=${this.controller.getView().route.id}${modeQuery}${reportQuery}` }), 650);
  },
});
