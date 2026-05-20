/// <reference types="miniprogram-api-typings" />

declare const App: WechatMiniprogram.App.Constructor
declare const Page: WechatMiniprogram.Page.Constructor
declare const Component: WechatMiniprogram.Component.Constructor
declare const getApp: WechatMiniprogram.GetApp
declare const getCurrentPages: WechatMiniprogram.GetCurrentPages
declare const wx: WechatMiniprogram.Wx

declare function setTimeout(fn: () => void, ms: number): number
declare function clearTimeout(id: number): void
declare function setInterval(fn: () => void, ms: number): number
declare function clearInterval(id: number): void
