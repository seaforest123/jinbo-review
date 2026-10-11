const list = [
  {
    pagePath: '/pages/home/index',
    text: '首页',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTUgMTYgTDE2IDYgTDI3IDE2IE05IDE0IFYyNiBIMjMgVjE0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmNGQ3N2IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+',
  },
  {
    pagePath: '/pages/archive/index',
    text: '金箔志',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTE2IDkgQzE2IDcgMTQgNiAxMiA2IEg2IFYyMyBIMTIgQzE0IDIzIDE2IDI0IDE2IDI2IEMxNiAyNCAxOCAyMyAyMCAyMyBIMjYgVjYgSDIwIEMxOCA2IDE2IDcgMTYgOSBaIiBmaWxsPSJub25lIiBzdHJva2U9IiNmNGQ3N2IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+',
  },
  {
    pagePath: '/pages/media/index',
    text: '影像记录',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTYgOCBDNiA2LjkgNi45IDYgOCA2IEgyNCBDMjUuMSA2IDI2IDYuOSAyNiA4IFYyNCBDMjYgMjUuMSAyNS4xIDI2IDI0IDI2IEg4IEM2LjkgMjYgNiAyNS4xIDYgMjQgWiBNMTMgMTIgTDIwIDE2IEwxMyAyMCBaIiBmaWxsPSJub25lIiBzdHJva2U9IiNmNGQ3N2IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+',
  },
  {
    pagePath: '/pages/activity/index',
    text: '活动',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTYgMTAgSDI2IE02IDEwIFYyNCBDNiAyNS4xIDYuOSAyNiA4IDI2IEgyNCBDMjUuMSAyNiAyNiAyNS4xIDI2IDI0IFYxMCBDMjYgOC45IDI1LjEgOCAyNCA4IEg4IEM2LjkgOCA2IDguOSA2IDEwIFogTTExIDUgVjkgTTIxIDUgVjkgTTEwIDE3IEwxNCAyMSBMMjIgMTMiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y0ZDc3YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=',
  },
];

Component({
  data: {
    selected: 0,
    list,
  },
  methods: {
    switchTab(event) {
      const { index } = event.currentTarget.dataset;
      if (this.data.selected === index) return;
      wx.switchTab({ url: list[index].pagePath });
      this.setData({ selected: index });
    },
  },
});
