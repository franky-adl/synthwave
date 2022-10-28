import * as THREE from "three"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader"

global.THREE = THREE

/**
 * @param {string} url - Path to equirectandular .hdr
 * @returns {Promise<THREE.Texture>}
 */
export const loadHDRI = (url) => {
    return new Promise((resolve) => {
        const hdrEquirect = new RGBELoader().load(url, function () {
            hdrEquirect.mapping = THREE.EquirectangularReflectionMapping
            resolve(hdrEquirect)
        })
    })
}

/**
 * https://www.prowaretech.com/articles/current/javascript/three-js/cover-scene-background-with-image#!
 * Setting background for threejs that doesn't stretch
 * @param {*} scene
 * @param {*} backgroundImageWidth
 * @param {*} backgroundImageHeight
 */
export const maintainBgAspect = (scene, backgroundImageWidth, backgroundImageHeight) => {
    var windowSize = function (withScrollBar) {
        var wid = 0
        var hei = 0
        if (typeof window.innerWidth != "undefined") {
            wid = window.innerWidth
            hei = window.innerHeight
        } else {
            if (document.documentElement.clientWidth == 0) {
                wid = document.body.clientWidth
                hei = document.body.clientHeight
            } else {
                wid = document.documentElement.clientWidth
                hei = document.documentElement.clientHeight
            }
        }
        return { width: wid - (withScrollBar ? wid - document.body.offsetWidth + 1 : 0), height: hei }
    }

    if (scene.background) {
        var size = windowSize(true)
        var factor = backgroundImageWidth / backgroundImageHeight / (size.width / size.height)

        scene.background.offset.x = factor > 1 ? (1 - 1 / factor) / 2 : 0
        scene.background.offset.y = factor > 1 ? 0 : (1 - factor) / 2

        scene.background.repeat.x = factor > 1 ? 1 / factor : 1
        scene.background.repeat.y = factor > 1 ? 1 : factor
    }
}