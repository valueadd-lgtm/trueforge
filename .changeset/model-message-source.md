---
'@truefoundry/trueforge-core': patch
'@truefoundry/trueforge': patch
---

Require `source` (`provider_type/provider_name/model_name`) on every `model.message`, stamp it from `ILLM` before streaming starts, and backfill existing session events / turn outputs / assistant context from the session agent model.
