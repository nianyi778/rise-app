const TABS = [
    { url: '/pages/home/home' },
    { url: '/pages/reflection/reflection' },
    { url: '/pages/report/report' },
    { url: '/pages/goals/goals' },
];
Component({
    data: {
        selected: 0,
    },
    methods: {
        onTabTap(e) {
            var _a;
            const index = e.currentTarget.dataset['index'];
            const url = (_a = TABS[index]) === null || _a === void 0 ? void 0 : _a.url;
            if (!url)
                return;
            wx.switchTab({ url });
        },
    },
});
