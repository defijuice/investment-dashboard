import { GoogleSheetsClient } from '../core/googleSheets.js';

async function updateMissingFileStatus() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 파일 시트 전체 조회
  const files = await sheets.getAllRows('파일');

  // 출자사업 시트 조회 (파일ID → 출자사업ID 매핑용)
  const projects = await sheets.getAllRows('출자사업');

  // 신청현황 시트 조회
  const applications = await sheets.getAllRows('신청현황');

  // 처리상태가 '완료'인데 현황이 비어있는 파일 찾기
  const needsUpdate = files.filter(f =>
    f['처리상태'] === '완료' && !f['현황']
  );

  console.log('=== 현황 업데이트 필요한 파일 ===');
  console.log('총', needsUpdate.length, '건\n');

  if (needsUpdate.length === 0) {
    console.log('업데이트 필요한 파일이 없습니다.');
    return;
  }

  for (const file of needsUpdate) {
    console.log(`\n처리 중: ${file['ID']} | ${file['파일유형']} | ${file['파일명']?.substring(0, 50)}`);

    try {
      // 이 파일이 연결된 출자사업 찾기
      let linkedProjectId = null;
      const fileId = file['ID'];
      const fileType = file['파일유형'];

      for (const project of projects) {
        if (fileType === '접수현황') {
          const supportFileIds = (project['지원파일ID'] || '').split(',').map(s => s.trim());
          if (supportFileIds.includes(fileId)) {
            linkedProjectId = project['ID'];
            break;
          }
        } else if (fileType === '선정결과') {
          const resultFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim());
          if (resultFileIds.includes(fileId)) {
            linkedProjectId = project['ID'];
            break;
          }
        }
      }

      if (!linkedProjectId) {
        console.log('  → 연결된 출자사업 없음');
        continue;
      }

      // 해당 출자사업의 신청현황 통계 계산
      const projectApps = applications.filter(app => app['출자사업ID'] === linkedProjectId);
      const total = projectApps.length;

      let summary = '';

      if (fileType === '접수현황') {
        // 접수현황 파일: "신청조합 N개, 공동GP N개(2개조합 N건, 3개조합 N건), 총 신청현황 N건"
        // 공동GP 분석: 비고에 "공동GP" 포함된 항목
        const jointGpApps = projectApps.filter(app => (app['비고'] || '').includes('공동GP'));

        // 공동GP 조합 분석 (같은 출자사업+출자분야로 그룹핑)
        const jointGpGroups = new Map();
        for (const app of jointGpApps) {
          const key = `${app['출자사업ID']}|${app['출자분야']}|${app['비고']}`;
          if (!jointGpGroups.has(key)) {
            jointGpGroups.set(key, []);
          }
          jointGpGroups.get(key).push(app);
        }

        // 조합 크기별 카운트
        const groupSizeCounts = {};
        for (const [_, group] of jointGpGroups) {
          const size = group.length;
          groupSizeCounts[size] = (groupSizeCounts[size] || 0) + 1;
        }

        const uniqueJointGpCount = jointGpGroups.size;
        const nonJointGpCount = total - jointGpApps.length;
        const originalCount = nonJointGpCount + uniqueJointGpCount; // 원래 신청조합 수

        if (uniqueJointGpCount > 0) {
          const sizeDetails = Object.entries(groupSizeCounts)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([size, count]) => `${size}개조합 ${count}건`)
            .join(', ');
          summary = `신청조합 ${originalCount}개, 공동GP ${uniqueJointGpCount}개(${sizeDetails}), 총 신청현황 ${total}건`;
        } else {
          summary = `신청조합 ${total}개, 총 신청현황 ${total}건`;
        }
      } else if (fileType === '선정결과') {
        // 선정결과 파일: "총 N개 중 선정 N건"
        const selected = projectApps.filter(app => app['상태'] === '선정').length;
        summary = `총 ${total}개 중 선정 ${selected}건`;
      }

      if (summary) {
        await sheets.setValues(`파일!I${file._rowIndex}`, [[summary]]);
        console.log(`  → 현황 업데이트됨: ${summary}`);
      }
    } catch (error) {
      console.error(`  → 에러: ${error.message}`);
    }
  }

  console.log('\n=== 완료 ===');
}

updateMissingFileStatus().catch(console.error);
