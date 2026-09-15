# Interior v52 QA contract

## 필수 회귀

1. 실제 `quote-review-report` HTML에서 `InteriorQuoteReview52` 자동 로드
2. 백업 파일이 허용 7개 키의 raw 문자열을 byte-for-byte 보존
3. 무관한 localStorage 키는 백업에 포함하지 않음
4. 실제 다운로드 JSON 생성
5. extra key / 잘못된 format / 잘못된 value type 거부
6. 유효 파일 선택 후 미리보기 전 현재 저장값 무변경
7. 미리보기에는 데이터 유무/byte 크기만 표시
8. 강제 쓰기 실패 시 7개 추적값 전체 롤백
9. 정상 복원 시 7개 키는 파일 상태와 정확히 일치
10. 정상 복원 시 무관한 localStorage 보존
11. null 값은 해당 허용 키 삭제로 복원
12. 390x844 모바일 document-level horizontal overflow 없음
13. print media에서 백업 조작 UI 비노출
14. browser console/runtime error 없음
15. production surface check PASS

## 비운영 원칙

- `main` / 운영 배포 없음
- 서버 업로드 없음
- 사용자 명시 적용 전 복원 없음
