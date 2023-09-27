# bind_google_cloud_iam

IAM Conditionsを含むIAM Policy Bindingを追加するサンプル

# Usage

環境変数を設定する。 `.env` に書いても良い。

```bash
PROJECT_ID='your-project-id'
IAM_ROLE_ID='roles/viewer'
IAM_MEMBER='user:username@example.com'
CONDITION='resource.name.startsWith("projects/_/buckets/")'
```

プログラムを実行する

```bash
$ nodenv local
18.16.0

$ node -v
v18.16.0

$ npm i

$ npx ts-node src/index.ts
```
