# [1.7.0](https://github.com/boletrics/auth-svc/compare/v1.6.0...v1.7.0) (2025-12-27)


### Features

* Add authentication to avatar endpoints ([cf70755](https://github.com/boletrics/auth-svc/commit/cf707550af1f2d83fe5f4f27bb994cb30cf63ce3))
* Add JWT and Email OTP auth plugins ([17ac627](https://github.com/boletrics/auth-svc/commit/17ac627da0266491985c734621087fa852d9dfbb))
* **admin:** add admin organizations management endpoints and register router ([c2b41b0](https://github.com/boletrics/auth-svc/commit/c2b41b084389e7b4a9cc5164eb29bd35f5f69998))
* **auth:** add email OTP functionality and improve error handling for email sending ([f1f19c1](https://github.com/boletrics/auth-svc/commit/f1f19c140dcf1027d2b4589150fd6b890847fd79))
* **auth:** enhance local development configuration for cookie handling ([a59c2d4](https://github.com/boletrics/auth-svc/commit/a59c2d4752a580f493c679d7ce55f3613e030a1c))
* **avatars:** implement Cloudflare Images integration for avatar uploads and management ([4f7162e](https://github.com/boletrics/auth-svc/commit/4f7162e8418f6f0dea716e87afc30132c18fdb8c))

# [1.6.0](https://github.com/boletrics/auth-svc/compare/v1.5.0...v1.6.0) (2025-12-26)


### Features

* Integrate Better Auth OpenAPI plugin ([fa5a6e8](https://github.com/boletrics/auth-svc/commit/fa5a6e8beecd03a92eafc34ecaa25ea893860cd1))

# [1.5.0](https://github.com/boletrics/auth-svc/compare/v1.4.1...v1.5.0) (2025-12-22)


### Features

* **auth:** add admin plugin for user management ([80c7021](https://github.com/boletrics/auth-svc/commit/80c7021a6144144954d854a10a14836bffba0344))

## [1.4.1](https://github.com/boletrics/auth-svc/compare/v1.4.0...v1.4.1) (2025-12-22)


### Bug Fixes

* **org:** use partner app URL for invitation emails ([e41fe3e](https://github.com/boletrics/auth-svc/commit/e41fe3eec8ecb91dac5e2cfdbeae176bccebf16f))

# [1.4.0](https://github.com/boletrics/auth-svc/compare/v1.3.2...v1.4.0) (2025-12-22)


### Features

* **org:** add list-invitations and cancel-invitation endpoints ([3264aa0](https://github.com/boletrics/auth-svc/commit/3264aa0171f673e979b5a7b88f0b8bd06e5318e3))

## [1.3.2](https://github.com/boletrics/auth-svc/compare/v1.3.1...v1.3.2) (2025-12-22)


### Bug Fixes

* renamed the organization name template ([29afe12](https://github.com/boletrics/auth-svc/commit/29afe12d6c1a990ba561c6da1e1ad9c21e2e3009))

## [1.3.1](https://github.com/boletrics/auth-svc/compare/v1.3.0...v1.3.1) (2025-12-22)


### Bug Fixes

* **org:** align db tables with better-auth defaults ([79e4da4](https://github.com/boletrics/auth-svc/commit/79e4da4296e62f11860c12ab4b41477ef90e9f2f))
* **org:** use plural table names with Prisma @[@map](https://github.com/map) ([591d90c](https://github.com/boletrics/auth-svc/commit/591d90c26e9c995fa57292b172f6e52dc77ce8a2))

# [1.3.0](https://github.com/boletrics/auth-svc/compare/v1.2.1...v1.3.0) (2025-12-22)


### Features

* Add Better Auth organization plugin ([c145df5](https://github.com/boletrics/auth-svc/commit/c145df564b6e7cc585986204af5c9a1b6a1650de))

## [1.2.1](https://github.com/boletrics/auth-svc/compare/v1.2.0...v1.2.1) (2025-12-21)


### Bug Fixes

* logo header in email templates ([8b3d252](https://github.com/boletrics/auth-svc/commit/8b3d2527b390959daf4c95b3bec28303de30245d))

# [1.2.0](https://github.com/boletrics/auth-svc/compare/v1.1.0...v1.2.0) (2025-12-21)


### Features

* add Turnstile validation, KV storage, and public routes for email/reset ([82ef11c](https://github.com/boletrics/auth-svc/commit/82ef11c4381e0f481d4eb18a55d3deac6aa7c857))

# [1.1.0](https://github.com/boletrics/auth-svc/compare/v1.0.0...v1.1.0) (2025-12-21)


### Features

* add email verification and password reset with Mandrill integration ([9a2dd91](https://github.com/boletrics/auth-svc/commit/9a2dd916cc5a0a8ab1f33afde46b78d8f9851985))

# 1.0.0 (2025-12-19)


### Features

* Add CI and release workflows ([2f83ae8](https://github.com/boletrics/auth-svc/commit/2f83ae8cd29a921fd957e41e96c68ebe290a0650))
