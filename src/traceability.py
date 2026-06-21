from typing import List, Dict, Any

class TraceabilityMatrix:
    """
    Validates coverage between requirements, scenarios, and test cases.
    Ensures zero dangling requirements or untraced scenarios.
    """
    @staticmethod
    def compute_matrix(requirements: List[Dict[str, Any]], 
                       scenarios: List[Dict[str, Any]], 
                       test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:

        req_to_scenarios = {r["id"]: [] for r in requirements}
        sc_to_test_cases = {s["id"]: [] for s in scenarios}
        req_to_test_cases = {r["id"]: [] for r in requirements}

        # Map Scenarios to Requirements
        for sc in scenarios:
            req_id = sc.get("requirement_id")
            if req_id in req_to_scenarios:
                req_to_scenarios[req_id].append(sc["id"])

        # Map Test Cases to Scenarios and Requirements
        for tc in test_cases:
            sc_id = tc.get("scenario_id")
            req_id = tc.get("requirement_id")

            if sc_id in sc_to_test_cases:
                sc_to_test_cases[sc_id].append(tc["id"])
            if req_id in req_to_test_cases:
                req_to_test_cases[req_id].append(tc["id"])

        # Identify gaps
        uncovered_requirements = []
        for req_id, tcs in req_to_test_cases.items():
            if not tcs:
                uncovered_requirements.append(req_id)

        uncovered_scenarios = []
        for sc_id, tcs in sc_to_test_cases.items():
            if not tcs:
                uncovered_scenarios.append(sc_id)

        total_reqs = len(requirements)
        covered_reqs = total_reqs - len(uncovered_requirements)
        coverage_score = (covered_reqs / total_reqs * 100) if total_reqs > 0 else 100.0

        return {
            "traceability_score": coverage_score,
            "req_to_scenarios_map": req_to_scenarios,
            "sc_to_test_cases_map": sc_to_test_cases,
            "uncovered_requirements": uncovered_requirements,
            "uncovered_scenarios": uncovered_scenarios
        }
