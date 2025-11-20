# ALB JWT Validation with Cognito

ALB の JWT 検証機能を使って Cognito で認証するサンプルプロジェクト

## アーキテクチャ

![Architecture](./architecture.drawio.svg)

マルチテナント SaaS のテナントルーティングを実現するアーキテクチャです。

- Cognito: テナントユーザの認証（グループ単位でテナント分離）
- ALB: JWT 検証とテナントルーティング（プール型）
- Lambda: テナントごとのバックエンド（サイロ型）

## デプロイ

```bash
# 依存関係のインストール
pnpm install

# デプロイ（Lambdaビルド + CDKデプロイ）
pnpm deploy
```

## ユーザー作成

デプロイ後、以下のコマンドでユーザーを作成してください:

```bash
# 環境変数設定
USER_POOL_ID=xxxxxxxxxxxx

# userA作成
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username userA \
  --user-attributes Name=email,Value=userA@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

# userAをtenant-Aグループに追加
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username userA \
  --group-name tenant-A

# userAのパスワード設定
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username userA \
  --password 'YourPassword123!' \
  --permanent

# userB作成
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username userB \
  --user-attributes Name=email,Value=userB@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

# userBをtenant-Bグループに追加
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username userB \
  --group-name tenant-B

# userBのパスワード設定
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username userB \
  --password 'YourPassword123!' \
  --permanent
```

## JWT トークン取得

```bash
# 環境変数設定
USER_POOL_ID=xxxxxxxxxxxx
CLIENT_ID=xxxxxxxxxxxx

# userAでログインしてAccessTokenを取得
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=userA,PASSWORD=YourPassword123! \
  --query 'AuthenticationResult.AccessToken' \
  --output text

# userBでログインしてAccessTokenを取得
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=userB,PASSWORD=YourPassword123! \
  --query 'AuthenticationResult.AccessToken' \
  --output text
```
