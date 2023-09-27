import { google, cloudresourcemanager_v3 } from 'googleapis';
import dotenv from 'dotenv';

// 環境変数から渡す
dotenv.config();
const {
  PROJECT_ID = 'test-project',
  IAM_ROLE_ID = 'roles/viewer',
  IAM_MEMBER = 'user:test-member@example.com',
  CONDITION = 'resource.name.startsWith("projects/_/buckets/")',
} = process.env;

const iamPolicySchema: cloudresourcemanager_v3.Schema$Policy = {
  bindings: [
    {
      role: IAM_ROLE_ID,
      members: [IAM_MEMBER],
      condition: {
        expression: CONDITION,
        title: 'Condition',
        description: 'test',
      },
    },
  ],
};

async function getIamPolicy(
  projectId: string,
  client: cloudresourcemanager_v3.Cloudresourcemanager,
  version = 3
): Promise<cloudresourcemanager_v3.Schema$Policy> {
  const getIamPolicyParams: cloudresourcemanager_v3.Params$Resource$Projects$Getiampolicy = {
    resource: `projects/${projectId}`,
    requestBody: { options: { requestedPolicyVersion: version } },
  };
  const { data } = await client.projects.getIamPolicy(getIamPolicyParams);
  return data;
}

function calculateNewPolicy(
  currentBindings: cloudresourcemanager_v3.Schema$Binding[],
  additionalBindings: cloudresourcemanager_v3.Schema$Binding[]
) {
  const newBindings = [...currentBindings];
  if (additionalBindings) {
    for (const binding of additionalBindings) {
      // NOTE sameRoleBindingsはnewBindingsの参照を持っているので、newBindingsへのmutableな変更ができる
      const sameRoleBindings = newBindings.filter((b) => b.role === binding.role);
      // binding.role が currentBindings に存在しない場合は、そのまま追加する
      if (sameRoleBindings.length === 0) {
        newBindings.push(binding);
        continue;
      }
      // すでに role が存在しており、condition が同じ場合は、members を追加する
      const target = sameRoleBindings.find((b) => b.condition?.expression === binding.condition?.expression);
      if (target) {
        // unique な members にする
        const newMembers = [...new Set([...(target.members || []), ...(binding.members || [])])];
        target.members = newMembers;
        continue;
      }
      // roleが存在しており、condition が異なる場合は新しいbindingを追加した上で既存のbindingから対象のmemberを削除する
      newBindings.push(binding);
      sameRoleBindings.forEach((b) => {
        if (b.members && binding.members) {
          const newMembers = b.members.filter((m) => !binding.members?.includes(m));
          b.members = newMembers;
        }
      });
    }
  }
  return newBindings;
}

async function setIamPolicy(
  projectId: string,
  client: cloudresourcemanager_v3.Cloudresourcemanager,
  policy: cloudresourcemanager_v3.Schema$Policy
) {
  const setIamPolicyParams: cloudresourcemanager_v3.Params$Resource$Projects$Setiampolicy = {
    resource: `projects/${projectId}`,
    requestBody: {
      policy,
    },
  };
  const { data } = await client.projects.setIamPolicy(setIamPolicyParams);
  return data;
}

async function main() {
  // auth clientの作成
  const authOptions = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };
  const auth = new google.auth.GoogleAuth(authOptions);
  const resourceManagerClient = google.cloudresourcemanager({ version: 'v3', auth });

  // 現時点のポリシーを取得
  const policy = await getIamPolicy(PROJECT_ID, resourceManagerClient);
  const { bindings, etag, version } = policy;
  if (etag == null || version == null) {
    throw new Error('etag or version is null');
  }
  if (bindings == null) {
    throw new Error('bindings is null');
  }

  // ポリシーを更新
  const newBindings = calculateNewPolicy(
    bindings,
    iamPolicySchema.bindings as cloudresourcemanager_v3.Schema$Binding[]
  );
  const newPolicy = { bindings: newBindings, etag, version };
  const changedPolicy = await setIamPolicy(PROJECT_ID, resourceManagerClient, newPolicy);
  console.log(JSON.stringify(changedPolicy.bindings?.filter((binding) => binding.role === IAM_ROLE_ID), null, 2));
}

main().catch(console.error);
